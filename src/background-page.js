import {OK, toString as statusToString} from "/src/common/status.js";
import showSlideshowTab from "/src/show-slideshow-tab.js";
import {
  clear as clearIconStore,
  compact as compactIconStore,
  lookup,
  open as openIconStore
} from "/src/favicon-service.js";
import archiveEntries from "/src/feed-ops/archive-entries.js";
import refreshFeedIcons from "/src/feed-ops/refresh-feed-icons.js";
import removeLostEntries from "/src/feed-ops/remove-lost-entries.js";
import removeOrphanedEntries from "/src/feed-ops/remove-orphaned-entries.js";
import updateBadgeText from "/src/feed-ops/update-badge-text.js";
import FeedPoll from "/src/feed-poll/poll-feeds.js";
import {open as openFeedStore} from "/src/rdb/rdb.js";

function handleCompactFaviconsAlarm(alarm) {
  return compactIconStore().catch(console.error);
}

function handleArchiveAlarmWakeup(alarm) {
  let conn, channel, maxAge;
  return archiveEntries(conn, channel, maxAge).catch(console.error);
}

async function handleLostEntriesAlarm(alarm) {
  console.log('Removing lost entries...');

  let conn;
  const channel = new BroadcastChannel('reader');
  try {
    await removeLostEntries(conn, channel);
  } finally {
    channel.close();
  }
}

async function handleOrphanEntriesAlarm(alarm) {
  let conn;// leave undefined for auto-connect
  const channel = new BroadcastChannel('reader');
  try {
    await removeOrphanedEntries(conn, channel);
  } finally {
    channel.close();
  }
}

async function handleRefreshFeedIconsAlarm(alarm) {
  console.log('Refreshing feed favicons...');
  const [feedConn, iconConn] = await Promise.all([openFeedStore(), openIconStore()]);
  await refreshFeedIcons(feedConn, iconConn);
  feedConn.close();
  iconConn.close();
}

async function handlePollFeedsAlarm(alarm) {
  console.log('Polling feeds...');

  // If the non-idle restriction is in place, and the computer is not idle, then avoid polling.
  if('ONLY_POLL_IF_IDLE' in localStorage) {
    const idlePeriodSecs = 30;
    const state = await queryIdleState(idlePeriodSecs);
    if(state !== 'locked' || state !== 'idle') {
      console.debug('Not idle, dismissing poll');
      return;
    }
  }

  const poll = new FeedPoll();
  poll.init();
  try {
    await poll.open();
    await poll.pollFeeds();
  } finally {
    poll.close();
  }
}

function queryIdleState(idlePeriodSecs) {
  return new Promise(function executor(resolve, reject) {
    chrome.idle.queryState(idlePeriodSecs, resolve);
  });
}


const cli = {};

cli.refreshIcons = async function() {
  console.log('Refreshing feed favicons...');
  const [feedConn, iconConn] = await Promise.all([openFeedStore(), openIconStore()]);
  await refreshFeedIcons(feedConn, iconConn);
  feedConn.close();
  iconConn.close();
};

cli.archiveEntries = function(limit) {
  console.log('Archiving entries...');

  // TODO: use a real channel (in which case this should be async fn again)
  let conn, channel, maxAge;
  archiveEntries(conn, channel, maxAge).catch(console.error);
};

cli.pollFeeds = async function() {
  console.log('Polling feeds...');
  const poll = new FeedPoll();
  poll.init();
  poll.ignoreRecencyCheck = true;
  poll.ignoreModifiedCheck = true;

  try {
    await poll.open();
    await poll.pollFeeds();
  } finally {
    poll.close();
  }
};

cli.removeLostEntries = async function(limit) {
  console.log('Removing lost entries...');

  const channel = new BroadcastChannel('reader');
  let conn;
  try {
    await removeLostEntries(conn, channel);
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
  if(cached) {
    query.conn = await openIconStore();
  }

  const iconURLString = await lookup(query);
  if(cached) {
    query.conn.close();
  }

  return iconURLString;
};

// Expose cli to console
window.cli = cli;



console.debug('Initializing background page');

chrome.runtime.onInstalled.addListener(function(event) {
  console.debug('Received install event:', event);

  console.log('Setting up feed store database');
  openFeedStore().then(function(conn) {
    return conn.close();
  }).catch(console.error);

  console.log('Setting up favicon database');
  openIconStore().then(function(conn) {
    return conn.close();
  }).catch(console.error);
});


chrome.browserAction.onClicked.addListener(showSlideshowTab);

updateBadgeText();

chrome.alarms.onAlarm.addListener(function(alarm) {
  console.debug('Alarm awoke:', alarm.name);
  localStorage.LAST_ALARM = alarm.name;

  switch(alarm.name) {
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
chrome.alarms.create('remove-entries-missing-urls', {periodInMinutes: 60 * 24 * 7});
chrome.alarms.create('remove-orphaned-entries', {periodInMinutes: 60 * 24 * 7});
chrome.alarms.create('refresh-feed-icons', {periodInMinutes: 60 * 24 * 7 * 2});
chrome.alarms.create('compact-favicon-db', {periodInMinutes: 60 * 24 * 7});
