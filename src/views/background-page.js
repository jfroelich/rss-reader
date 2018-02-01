import {clear as clearIconStore, compact as compactIconStore, lookup, open as openIconDb} from '/src/favicon-service.js';
import archiveEntries from '/src/feed-ops/archive-entries.js';
import refreshFeedIcons from '/src/feed-ops/refresh-feed-icons.js';
import removeLostEntries from '/src/feed-ops/remove-lost-entries.js';
import removeOrphanedEntries from '/src/feed-ops/remove-orphaned-entries.js';
import {closePollFeedsContext, createPollFeedsContext, pollFeeds} from '/src/feed-poll/poll-feeds.js';
import {open as openReaderDb} from '/src/rdb.js';
import showSlideshowTab from '/src/views/show-slideshow-tab.js';
import updateBadgeText from '/src/views/update-badge-text.js';

// TODO: this is doing somethings that should be in a layer below the view. move
// things into that other layer. This should be a dumber view, like a
// thin-client

function handleCompactFaviconsAlarm(alarm) {
  return compactIconStore().catch(console.error);
}

function handleArchiveAlarmWakeup(alarm) {
  let conn, channel, maxAge;
  return archiveEntries(conn, channel, maxAge).catch(console.error);
}

async function handleLostEntriesAlarm(alarm) {
  let conn;
  const channel = new BroadcastChannel('reader');
  try {
    await removeLostEntries(conn, channel, console);
  } finally {
    channel.close();
  }
}

async function handleOrphanEntriesAlarm(alarm) {
  let conn;
  const channel = new BroadcastChannel('reader');
  try {
    await removeOrphanedEntries(conn, channel);
  } finally {
    channel.close();
  }
}

async function handleRefreshFeedIconsAlarm(alarm) {
  console.log('Refreshing feed favicons...');
  const [feedConn, iconConn] =
      await Promise.all([openReaderDb(), openIconDb()]);
  await refreshFeedIcons(feedConn, iconConn);
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

  const context = await createPollFeedsContext();
  context.console = console;  // enable logging
  await pollFeeds(context);
  closePollFeedsContext(context);
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
      await Promise.all([openReaderDb(), openIconDb()]);
  await refreshFeedIcons(feedConn, iconConn);
  feedConn.close();
  iconConn.close();
};

cli.archiveEntries = function(limit) {
  console.log('Archiving entries...');

  let conn, maxAge;
  const channel = new BroadcastChannel('reader');
  archiveEntries(conn, channel, maxAge).catch(console.error).finally(() => {
    if (channel) {
      channel.close();
    }
  });
};

cli.pollFeeds = async function() {
  console.log('Polling feeds...');
  const context = await createPollFeedsContext();
  context.ignoreRecencyCheck = true;
  context.ignoreModifiedCheck = true;
  context.console = console;
  await pollFeeds(context);
  closePollFeedsContext(context);
};

cli.removeLostEntries = async function(limit) {
  const channel = new BroadcastChannel('reader');
  let conn;
  try {
    await removeLostEntries(conn, channel, console);
  } finally {
    channel.close();
  }
};

cli.removeOrphanedEntries = async function() {
  console.log('Removing orphaned entries...');

  let conn;
  const channel = new BroadcastChannel('reader');
  try {
    await removeOrphanedEntries(conn, channel);
  } finally {
    channel.close();
  }
};

cli.clearFavicons = clearIconStore;
cli.compactFavicons = compactIconStore;

cli.lookupFavicon = async function(url, cached) {
  const query = {};
  query.url = new URL(url);
  if (cached) {
    query.conn = await openIconDb();
  }

  const iconURLString = await lookup(query);
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
  openReaderDb()
      .then(function(conn) {
        return conn.close();
      })
      .catch(console.error);

  console.log('Setting up favicon database');
  openIconDb()
      .then(function(conn) {
        return conn.close();
      })
      .catch(console.error);
});

chrome.browserAction.onClicked.addListener(showSlideshowTab);

async function initBadge() {
  let conn;
  try {
    conn = await openReaderDb();
    updateBadgeText(conn);
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
      handleCompactFaviconsAlarm(alarm);
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
