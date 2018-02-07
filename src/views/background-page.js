import {clear as favicon_service_clear, compact as favicon_service_compact, lookup as favicon_service_lookup, open as favicon_service_open} from '/src/favicon-service.js';
import archive_entries from '/src/feed-ops/archive-entries.js';
import feed_store_refresh_all_icons from '/src/feed-ops/refresh-feed-icons.js';
import entry_store_remove_lost_entries from '/src/feed-ops/remove-lost-entries.js';
import entry_store_remove_orphans from '/src/feed-ops/remove-orphaned-entries.js';
import {poll_service_close_context, poll_service_create_context, poll_service_poll_feeds} from '/src/feed-poll/poll-feeds.js';
import {rdb_open} from '/src/rdb.js';
import show_slideshow_tab from '/src/views/show-slideshow-tab.js';
import badge_update_text from '/src/views/update-badge-text.js';

// TODO: this is doing somethings that should be in a layer below the view. move
// things into that other layer. This should be a dumber view, like a
// thin-client

function handle_compact_favicons_alarm(alarm) {
  return favicon_service_compact().catch(console.error);
}

function handle_archive_alarm_wakeup(alarm) {
  let conn, channel, max_age;
  return archive_entries(conn, channel, max_age).catch(console.error);
}

async function handle_lost_entries_alarm(alarm) {
  let conn;
  const channel = new BroadcastChannel('reader');
  try {
    await entry_store_remove_lost_entries(conn, channel, console);
  } finally {
    channel.close();
  }
}

async function handle_orphan_entries_alarm(alarm) {
  let conn;
  const channel = new BroadcastChannel('reader');
  try {
    await entry_store_remove_orphans(conn, channel);
  } finally {
    channel.close();
  }
}

async function handle_refresh_feed_icons_alarm(alarm) {
  const [reader_conn, favicon_conn] =
      await Promise.all([rdb_open(), favicon_service_open()]);
  await feed_store_refresh_all_icons(reader_conn, favicon_conn);
  reader_conn.close();
  favicon_conn.close();
}

async function handle_poll_feeds_alarm(alarm) {
  if ('ONLY_POLL_IF_IDLE' in localStorage) {
    const idle_period_secs = 30;
    const state = await query_idle_state(idle_period_secs);
    if (state !== 'locked' || state !== 'idle') {
      return;
    }
  }

  const context = await poll_service_create_context();
  context.console = console;  // enable logging
  await poll_service_poll_feeds(context);
  poll_service_close_context(context);
}

window.test_handle_poll_feeds_alarm = handle_poll_feeds_alarm;

function query_idle_state(idle_period_secs) {
  return new Promise(function executor(resolve, reject) {
    chrome.idle.queryState(idle_period_secs, resolve);
  });
}

const cli = {};

cli.refresh_icons = async function() {
  const [reader_conn, favicon_conn] =
      await Promise.all([rdb_open(), favicon_service_open()]);
  await feed_store_refresh_all_icons(reader_conn, favicon_conn);
  reader_conn.close();
  favicon_conn.close();
};

cli.archive_entries = function(limit) {
  let conn, max_age;
  const channel = new BroadcastChannel('reader');
  archive_entries(conn, channel, max_age).catch(console.error).finally(() => {
    if (channel) {
      channel.close();
    }
  });
};

cli.poll_service_poll_feeds = async function() {
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
  const channel = new BroadcastChannel('reader');
  let conn;
  try {
    await entry_store_remove_orphans(conn, channel);
  } finally {
    channel.close();
  }
};

cli.clear_favicons = favicon_service_clear;
cli.compact_favicons = favicon_service_compact;

cli.lookup_favicon = async function(url, cached) {
  const query = {};
  query.url = new URL(url);
  if (cached) {
    query.conn = await favicon_service_open();
  }

  const icon_url_string = await favicon_service_lookup(query);
  if (cached) {
    query.conn.close();
  }

  return icon_url_string;
};

window.cli = cli;  // expose to console

console.debug('Initializing background page');

chrome.runtime.onInstalled.addListener(function(event) {
  console.log('Setting up feed store database');
  rdb_open()
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

async function badge_init() {
  let conn;
  try {
    conn = await rdb_open();

    // Here we await, because that is the entire point of this init function
    // I think this is the only place where we actually block
    await badge_update_text(conn);
  } catch (error) {
    console.error(error);
  } finally {
    if (conn) {
      conn.close();
    }
  }
}

badge_init();

chrome.alarms.onAlarm.addListener(function(alarm) {
  console.debug('Alarm awoke:', alarm.name);
  localStorage.LAST_ALARM = alarm.name;

  switch (alarm.name) {
    case 'archive':
      handle_archive_alarm_wakeup(alarm).catch(console.error);
      break;
    case 'poll':
      handle_poll_feeds_alarm(alarm).catch(console.error);
      break;
    case 'remove-entries-missing-urls':
      handle_lost_entries_alarm(alarm).catch(console.error);
      break;
    case 'remove-orphaned-entries':
      handle_orphan_entries_alarm(alarm).catch(console.error);
      break;
    case 'refresh-feed-icons':
      handle_refresh_feed_icons_alarm(alarm).catch(console.error);
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
