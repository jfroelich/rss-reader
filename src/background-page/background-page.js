import {OK, toString as statusToString} from "/src/common/status.js";
import showSlideshowTab from "/src/show-slideshow-tab.js";
import FaviconCache from "/src/favicon/cache.js";
import FaviconLookup from "/src/favicon/lookup.js";
import archiveEntries from "/src/feed-ops/archive-entries.js";
import refreshFeedIcons from "/src/feed-ops/refresh-feed-icons.js";
import updateBadgeText from "/src/feed-ops/update-badge-text.js";
import FeedPoll from "/src/feed-poll/poll-feeds.js";
import FeedStore from "/src/feed-store/feed-store.js";


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

  const store = new FeedStore();
  let status = await store.open();
  if(status !== OK) {
    console.error('Failed to open database:', statusToString(status));
    return status;
  }

  let maxAgeMs;
  const limit = 300;
  status = await archiveEntries(store, maxAgeMs, limit);
  if(status !== OK) {
    console.error('Failed to archive entries:', statusToString(status));
  }

  store.close();
  return status;
}

async function handleLostEntriesAlarm(alarm) {
  console.log('Removing lost entries...');

  const fs = new FeedStore();
  let status = await fs.open();
  if(status !== OK) {
    console.error('Failed to open database:', statusToString(status));
    return status;
  }

  const limit = 100;
  status = await fs.removeLostEntries(limit);
  if(status !== OK) {
    console.error('Failed to remove lost entries:', statusToString(status));
  }

  fs.close();
  return status;
}

async function handleOrphanEntriesAlarm(alarm) {
  console.log('Removing orphaned entries...');

  const fs = new FeedStore();
  let status = await fs.open();
  if(status !== OK) {
    console.error('Failed to open database:', statusToString(status));
    return status;
  }

  const limit = 100;
  status = await fs.removeOrphanedEntries(limit);
  if(status !== OK) {
    console.error('Failed to remove orphaned entries:', statusToString(status));
    fs.close();
    return status;
  }

  fs.close();
  return OK;
}

async function handleRefreshFeedIconsAlarm(alarm) {
  console.log('Refreshing feed favicons...');

  const fs = new FeedStore();
  const fc = new FaviconCache();
  const promises = [fs.open(), fc.open()];
  const conns = await Promise.all(promises);

  let status = conns[0][0];
  if(status !== OK) {
    console.error('Failed to open feed store:', statusToString(status));
    return;
  }

  status = conns[1][0];
  if(status !== OK) {
    console.error('Failed to open favicon cache:', statusToString(status));
    return;
  }

  status = await refreshFeedIcons(fs, fc);
  if(status !== OK) {
    console.error('Failed to refresh feed favicons:', statusToString(status));
  }

  fs.close();
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

  const fs = new FeedStore();
  const fc = new FaviconCache();

  const promises = [fs.open(), fc.open()];
  let statuses = await Promise.all(promises);

  let status = statuses[0];
  if(status !== OK) {
    console.error('Failed to open feed store:', statusToString(status));
    fc.close();
    return status;
  }

  status = statuses[1];
  if(status !== OK) {
    console.error('Failed to open favicon database:', statusToString(status));
    fs.close();
    return status;
  }

  status = await refreshFeedIcons(fs, fc);
  if(status !== OK) {
    console.error('Failed to refresh feed icons:', statusToString(status));
  }

  fs.close();
  fc.close();
  return status;
};

cli.archiveEntries = async function(limit) {
  console.log('Archiving entries...');

  const store = new FeedStore();
  let status = await store.open();
  if(status !== OK) {
    console.error('Failed to open database:', statusToString(status));
    return status;
  }

  let maxAgeMs;
  status = await archiveEntries(store, maxAgeMs, limit);
  if(status !== OK) {
    console.error('Failed to archive entries:', statusToString(status));
    store.close();
    return status;
  }

  store.close();
  return OK;
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
  const store = new FeedStore();
  let status = await store.open();
  if(status !== OK) {
    console.error('Failed to open database:', statusToString(status));
    return status;
  }

  status = await store.removeLostEntries(limit);
  if(status !== OK) {
    console.error('Failed to remove lost entries:', statusToString(status));
    store.close();
    return status;
  }

  store.close();
  return OK;
};

cli.removeOrphanedEntries = async function(limit) {
  console.log('Removing orphaned entries...');
  const store = new FeedStore();
  let status = await store.open();
  if(status !== OK) {
    console.error('Failed to open database:', statusToString(status));
    return status;
  }

  status = await store.removeOrphanedEntries(limit);
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
  const query = new FaviconLookup();
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

chrome.runtime.onInstalled.addListener(async function(event) {
  console.debug('Received install event:', event);

  // TODO: these tasks are independent, why make the second wait on the first to resolve?
  // This function may not even need to be async

  const fs = new FeedStore();
  try {
    await fs.open();
  } catch(error) {
    console.error(error);
  } finally {
    fs.close();
  }

  const fic = new FaviconCache();
  try {
    await fic.setup();
  } catch(error) {
    console.warn(error);
  }
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
