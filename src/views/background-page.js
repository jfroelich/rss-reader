import {clear as favicon_service_clear, compact as favicon_service_compact, lookup as favicon_service_lookup, open as favicon_service_open} from '/src/favicon-service.js';
import archive_entries from '/src/feed-ops/archive-entries.js';
import feed_store_refresh_all_icons from '/src/feed-ops/refresh-feed-icons.js';
import entry_store_remove_lost_entries from '/src/feed-ops/remove-lost-entries.js';
import entry_store_remove_orphans from '/src/feed-ops/remove-orphaned-entries.js';
import {poll_service_close_context, poll_service_create_context, poll_service_poll_feeds} from '/src/feed-poll/poll-feeds.js';
import {open as reader_db_open} from '/src/rdb.js';
import show_slideshow_tab from '/src/views/show-slideshow-tab.js';
import badge_update_text from '/src/views/update-badge-text.js';

// TODO: this is doing somethings that should be in a layer below the view. move
// things into that other layer. This should be a dumber view, like a
// thin-client

function handle_compact_favicons_alarm(alarm) {
  return favicon_service_compact().catch(console.error);
}

function handleArchiveAlarmWakeup(alarm) {
  let conn, channel, maxAge;
  return archive_entries(conn, channel, maxAge).catch(console.error);
}

async function handleLostEntriesAlarm(alarm) {
  let conn;
  const channel = new BroadcastChannel('reader');
  try {
    await entry_store_remove_lost_entries(conn, channel, console);
  } finally {
    channel.close();
  }
}

async function handleOrphanEntriesAlarm(alarm) {
  let conn;
  const channel = new BroadcastChannel('reader');
  try {
    await entry_store_remove_orphans(conn, channel);
  } finally {
    channel.close();
  }
}

async function handleRefreshFeedIconsAlarm(alarm) {
  console.log('Refreshing feed favicons...');
  const [feedConn, iconConn] =
      await Promise.all([reader_db_open(), favicon_service_open()]);
  await feed_store_refresh_all_icons(feedConn, iconConn);
  feedConn.close();
  iconConn.close();
}

async function handlePollFeedsAlarm(alarm) {
  console.log('poll feeds alarm wakeup');

  if ('ONLY_POLL_IF_IDLE' in localStorage) {
    const idlePeriodSecs = 30;
    const state = await queryIdleState(idlePeriodSecs);
    if (state !== 'locked' || state !== 'idle') {
      return;
    }
  }

  const context = await poll_service_create_context();
  context.console = console;  // enable logging
  await poll_service_poll_feeds(context);
  poll_service_close_context(context);
}

window.testHandlePollFeedsAlarm = handlePollFeedsAlarm;

function queryIdleState(idlePeriodSecs) {
  return new Promise(function executor(resolve, reject) {
    chrome.idle.queryState(idlePeriodSecs, resolve);
  });
}


const cli = {};

cli.refreshIcons = async function() {
  console.log('Refreshing feed favicons...');
  const [feedConn, iconConn] =
      await Promise.all([reader_db_open(), favicon_service_open()]);
  await feed_store_refresh_all_icons(feedConn, iconConn);
  feedConn.close();
  iconConn.close();
};

cli.archive_entries = function(limit) {
  console.log('Archiving entries...');

  let conn, maxAge;
  const channel = new BroadcastChannel('reader');
  archive_entries(conn, channel, maxAge).catch(console.error).finally(() => {
    if (channel) {
      channel.close();
    }
  });
};

cli.poll_service_poll_feeds = async function() {
  console.log('Polling feeds...');
  const context = await poll_service_create_context();
  context.ignoreRecencyCheck = true;
  context.ignoreModifiedCheck = true;
  context.console = console;
  await poll_service_poll_feeds(context);
  poll_service_close_context(context);
};

cli.entry_store_remove_lost_entries = async function(limit) {
  const channel = new BroadcastChannel('reader');
  let conn;
  try {
    await entry_store_remove_lost_entries(conn, channel, console);
  } finally {
    channel.close();
  }
};

cli.entry_store_remove_orphans = async function() {
  console.log('Removing orphaned entries...');

  let conn;
  const channel = new BroadcastChannel('reader');
  try {
    await entry_store_remove_orphans(conn, channel);
  } finally {
    channel.close();
  }
};

cli.clearFavicons = favicon_service_clear;
cli.compactFavicons = favicon_service_compact;

cli.lookupFavicon = async function(url, cached) {
  const query = {};
  query.url = new URL(url);
  if (cached) {
    query.conn = await favicon_service_open();
  }

  const iconURLString = await favicon_service_lookup(query);
  if (cached) {
    query.conn.close();
  }

  return iconURLString;
};


window.cli = cli;  // expose to console

console.debug('Initializing background page');

chrome.runtime.onInstalled.addListener(function(event) {
  console.debug('Received install event:', event);

  console.log('Setting up feed store database');
  reader_db_open()
      .then(function(conn) {
        return conn.close();
      })
      .catch(console.error);

  console.log('Setting up favicon database');
  favicon_service_open()
      .then(function(conn) {
        return conn.close();
      })
      .catch(console.error);
});

chrome.browserAction.onClicked.addListener(show_slideshow_tab);

async function initBadge() {
  let conn;
  try {
    conn = await reader_db_open();
    badge_update_text(conn);
  } catch (error) {
    console.error(error);
  } finally {
    if (conn) {
      conn.close();
    }
  }
}

initBadge();

chrome.alarms.onAlarm.addListener(function(alarm) {
  console.debug('Alarm awoke:', alarm.name);
  localStorage.LAST_ALARM = alarm.name;

  switch (alarm.name) {
    case 'archive':
      handleArchiveAlarmWakeup(alarm).catch(console.error);
      break;
    case 'poll':
      handlePollFeedsAlarm(alarm).catch(console.error);
      break;
    case 'remove-entries-missing-urls':
      handleLostEntriesAlarm(alarm).catch(console.error);
      break;
    case 'remove-orphaned-entries':
      handleOrphanEntriesAlarm(alarm).catch(console.error);
      break;
    case 'refresh-feed-icons':
      handleRefreshFeedIconsAlarm(alarm).catch(console.error);
      break;
    case 'compact-favicon-db':
      handle_compact_favicons_alarm(alarm);
      break;
    default:
      console.warn('unhandled alarm', alarm.name);
      break;
  }
});

chrome.alarms.create('archive', {periodInMinutes: 60 * 12});
chrome.alarms.create('poll', {periodInMinutes: 60});
chrome.alarms.create(
    'remove-entries-missing-urls', {periodInMinutes: 60 * 24 * 7});
chrome.alarms.create('remove-orphaned-entries', {periodInMinutes: 60 * 24 * 7});
chrome.alarms.create('refresh-feed-icons', {periodInMinutes: 60 * 24 * 7 * 2});
chrome.alarms.create('compact-favicon-db', {periodInMinutes: 60 * 24 * 7});
