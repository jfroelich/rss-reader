import {OK, toString as statusToString} from "/src/common/status.js";
import showSlideshowTab from "/src/show-slideshow-tab.js";
import {FaviconCache, FaviconService} from "/src/favicon-service/favicon-service.js";
import archiveEntries from "/src/feed-ops/archive-entries.js";
import refreshFeedIcons from "/src/feed-ops/refresh-feed-icons.js";
import updateBadgeText from "/src/feed-ops/update-badge-text.js";
import FeedPoll from "/src/feed-poll/poll-feeds.js";
import {
  open as openFeedStore,
  removeLostEntries,
  removeOrphanedEntries
} from "/src/feed-store/feed-store.js";



async function handleCompactFaviconsAlarm(alarm) {
  console.log('Compacting feed favicon cache...');

  const cache = new FaviconCache();
  let status = await cache.open();
  if(status !== OK) {
    console.error('Failed to open icon cache:', statusToString(status));
    return status;
  }

  let maxAgeMs;
  const limit = 100;
  status = await cache.compact(maxAgeMs, limit);
  if(status !== OK) {
    console.error('Failed to compact favicons:', statusToString(status));
  }

  cache.close();
  return status;
}

async function handleArchiveAlarmWakeup(alarm) {
  console.log('Archiving entries...');

  let [status, conn] = await openFeedStore();
  if(status !== OK) {
    console.error('Failed to open database:', statusToString(status));
    return status;
  }

  let maxAgeMs;
  const limit = 300;
  status = await archiveEntries(conn, maxAgeMs, limit);
  if(status !== OK) {
    console.error('Failed to archive entries:', statusToString(status));
  }

  conn.close();
  return status;
}

async function handleLostEntriesAlarm(alarm) {
  console.log('Removing lost entries...');

  let [status, conn] = await openFeedStore();
  if(status !== OK) {
    console.error('Failed to open database:', statusToString(status));
    return status;
  }

  const limit = 100;
  status = await removeLostEntries(conn, limit);
  if(status !== OK) {
    console.error('Failed to remove lost entries:', statusToString(status));
  }

  conn.close();
  return status;
}

async function handleOrphanEntriesAlarm(alarm) {
  console.log('Removing orphaned entries...');

  let [status, conn] = await openFeedStore();
  if(status !== OK) {
    console.error('Failed to open database:', statusToString(status));
    return status;
  }

  const limit = 100;
  status = await removeOrphanedEntries(conn, limit);
  if(status !== OK) {
    console.error('Failed to remove orphaned entries:', statusToString(status));
  }

  conn.close();
  return status;
}

async function handleRefreshFeedIconsAlarm(alarm) {
  console.log('Refreshing feed favicons...');

  const fc = new FaviconCache();
  const promises = [openFeedStore(), fc.open()];
  const resolutions = await Promise.all(promises);

  let [status, conn] = resolutions[0];
  if(status !== OK) {
    console.error('Failed to open feed store:', statusToString(status));
    return;
  }

  [status] = resolutions[1];
  if(status !== OK) {
    console.error('Failed to open favicon cache:', statusToString(status));
    return;
  }

  status = await refreshFeedIcons(conn, fc);
  if(status !== OK) {
    console.error('Failed to refresh feed favicons:', statusToString(status));
  }

  conn.close();
  fc.close();
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

  const fc = new FaviconCache();
  const promises = [openFeedStore(), fc.open()];
  const resolutions = await Promise.all(promises);

  let [status, conn] = resolutions[0];
  if(status !== OK) {
    console.error('Failed to open feed store:', statusToString(status));
    fc.close();
    return status;
  }

  status = resolutions[1];
  if(status !== OK) {
    console.error('Failed to open favicon database:', statusToString(status));
    conn.close();
    return status;
  }

  status = await refreshFeedIcons(conn, fc);
  if(status !== OK) {
    console.error('Failed to refresh feed icons:', statusToString(status));
  }

  conn.close();
  fc.close();
  return status;
};

cli.archiveEntries = async function(limit) {
  console.log('Archiving entries...');

  let [status, conn] = await openFeedStore();
  if(status !== OK) {
    console.error('Failed to open database:', statusToString(status));
    return status;
  }

  let maxAgeMs;
  status = await archiveEntries(conn, maxAgeMs, limit);
  if(status !== OK) {
    console.error('Failed to archive entries:', statusToString(status));
  }

  conn.close();
  return status;
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

  let [status, conn] = await openFeedStore();
  if(status !== OK) {
    console.error('Failed to open database:', statusToString(status));
    return status;
  }

  status = await removeLostEntries(conn, limit);
  if(status !== OK) {
    console.error('Failed to remove lost entries:', statusToString(status));
  }

  conn.close();
  return status;
};

cli.removeOrphanedEntries = async function(limit) {
  console.log('Removing orphaned entries...');

  let [status, conn] = await store.open();
  if(status !== OK) {
    console.error('Failed to open database:', statusToString(status));
    return status;
  }

  status = await removeOrphanedEntries(conn, limit);
  if(status !== OK) {
    console.error('Failed to remove orphaned entries:', statusToString(status));
  }

  store.close();
  return status;
};

cli.clearFavicons = async function() {
  const cache = new FaviconCache();
  let status = await cache.open();
  if(status !== OK) {
    console.error('Failed to open favicon cache:', statusToString(status));
    return status;
  }

  status = await cache.clear();
  if(status !== OK) {
    console.error('Failed to clear favicon cache:', statusToString(status));
  }

  cache.close();
  return status;
};

cli.compactFavicons = async function(limit) {
  const cache = new FaviconCache();
  let status = await cache.open();
  if(status !== OK) {
    console.error('Failed to open database:', statusToString(status));
    return status;
  }

  let maxAgeMs;
  status = await cache.compact(maxAgeMs, limit);
  if(status !== OK) {
    console.error('Failed to compact favicons:', statusToString(status));
  }

  cache.close();
  return status;
};

cli.lookupFavicon = async function(url, timeout, cacheless = true) {
  const query = new FaviconService();
  query.cache = new FaviconCache();
  query.fetchHTMLTimeoutMs = timeout;

  let status;
  if(!cacheless) {
    status = await query.cache.open();
    if(status !== OK) {
      console.error('Failed to open favicon cache', statusToString(status));
      return [status];
    }
  }

  const lookupURL = new URL(url);
  let iconURLString;
  [status, iconURLString] = await query.lookup(lookupURL);
  if(status !== OK) {
    console.error('Failed to lookup url', statusToString(status));
    if(!cacheless) {
      query.cache.close();
    }

    return [status];
  }

  if(!cacheless) {
    query.cache.close();
  }

  return [OK, iconURLString];
};

// Expose cli to console
window.cli = cli;



console.debug('Initializing background page');

chrome.runtime.onInstalled.addListener(function(event) {
  console.debug('Received install event:', event);

  console.log('Setting up feed store database');
  openFeedStore().then(function(result) {
    const [status, conn] = result;
    if(status !== OK) {
      console.error('Failed to open feed store database', status);
      return;
    }
    return conn.close();
  }).catch(console.error);

  console.log('Setting up favicon database');
  const fc = new FaviconCache();
  fc.open().then(function(status) {
    if(status !== OK) {
      console.error('Failed to open favicon database', status);
      return;
    }
    return fc.close();
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
    handleCompactFaviconsAlarm(alarm).catch(console.error);
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
