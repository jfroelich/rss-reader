import {OK} from "/src/common/status.js";
import showSlideshowTab from "/src/show-slideshow-tab.js";
import FaviconCache from "/src/favicon/cache.js";
import FaviconLookup from "/src/favicon/lookup.js";
import archiveEntries from "/src/feed-ops/archive-entries.js";
import refreshFeedIcons from "/src/feed-ops/refresh-feed-icons.js";
import FeedPoll from "/src/feed-poll/poll-feeds.js";
import FeedStore from "/src/feed-store/feed-store.js";
import updateBadgeText from "/src/update-badge-text.js";

async function onWakeup(alarm) {
  console.debug('onWakeup', alarm.name);
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
}

async function handleCompactFaviconsAlarm(alarm) {
  const cache = new FaviconCache();
  let maxAgeMs;

  // Hard code a sensible limit on the number of entries processed per alarm wakeup
  // TODO: perhaps this should come from config.js
  const limit = 300;
  try {
    await cache.open();
    const status = await cache.compact(maxAgeMs, limit);
    if(status !== Status.OK) {
      throw new Error('Failed with compact with status ' + status);
    }
  } catch(error) {
    console.warn(error);
  } finally {
    cache.close();
  }
}

async function handleArchiveAlarmWakeup(alarm) {
  const store = new FeedStore();
  let status = await store.open();
  if(status !== OK) {
    console.error('Failed to open database with status', status);
    return status;
  }

  let maxAgeMs;
  const limit = 500;
  status = await archiveEntries(store, maxAgeMs, limit);
  if(status !== OK) {
    console.error('Failed to archive entries with status', status);
    store.close();
    return status;
  }

  store.close();
  return OK;
}

async function handleLostEntriesAlarm(alarm) {
  const fs = new FeedStore();
  let status = await fs.open();
  if(status !== OK) {
    console.error('Failed to open database with status', status);
    return status;
  }

  const limit = 100;
  status = await fs.removeLostEntries(limit);
  if(status !== OK) {
    console.error('Failed to remove lost entries with status', status);
    fs.close();
    return status;
  }

  fs.close();
  return OK;
}

async function handleOrphanEntriesAlarm(alarm) {
  const fs = new FeedStore();
  let status = await fs.open();
  if(status !== OK) {
    console.error('Failed to open database with status', status);
    return status;
  }

  const limit = 100;
  status = await fs.removeOrphanedEntries(limit);
  if(status !== OK) {
    console.error('Failed to remove orphaned entries with status', status);
    fs.close();
    return status;
  }

  fs.close();
  return OK;
}

async function handleRefreshFeedIconsAlarm(alarm) {
  const fs = new FeedStore();
  const fc = new FaviconCache();
  const promises = [fs.open(), fc.open()];
  const conns = await Promise.all(promises);

  let status = conns[0][0];
  if(status !== OK) {
    console.error('Failed to open feed store');
    return;
  }

  status = conns[1][0];
  if(status !== OK) {
    console.error('Failed to open favicon cache');
    return;
  }

  status = await refreshFeedIcons(fs, fc);
  if(status !== OK) {
    console.error('Refresh feed icons error', status);
  }

  fs.close();
  fc.close();
}

async function handlePollFeedsAlarm(alarm) {
  // If the non-idle restriction is in place, and the computer is not idle, then avoid polling.
  if('ONLY_POLL_IF_IDLE' in localStorage) {
    const idlePeriodSecs = 30;
    const state = await queryIdleState(idlePeriodSecs);
    if(state !== 'locked' || state !== 'idle') {
      console.debug('Not idle, dismissing poll feeds wakeup alarm');
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

function addInstallListener(listener) {
  chrome.runtime.onInstalled.addListener(listener);
}

function addBadgeClickListener(listener) {
  chrome.browserAction.onClicked.addListener(listener);
}


const cli = {};

cli.refreshIcons = async function() {
  const fs = new FeedStore();
  const fc = new FaviconCache();

  const promises = [fs.open(), fc.open()];
  let statuses = await Promise.all(promises);

  let status = statuses[0];
  if(status !== OK) {
    console.error('Failed to open feed store database with status', status);
    fc.close();
    return status;
  }

  status = statuses[1];
  if(status !== OK) {
    console.error('Failed to open favicon database with status', status);
    fs.close();
    return status;
  }

  status = await refreshFeedIcons(fs, fc);
  if(status !== OK) {
    console.error('Failed to refresh feed icons with status', status);
  }

  fs.close();
  fc.close();
  return status;
};

cli.archiveEntries = async function(limit) {
  const store = new FeedStore();
  let status = await store.open();
  if(status !== OK) {
    console.error('Failed to open database with status', status);
    return status;
  }

  let maxAgeMs;
  status = await archiveEntries(store, maxAgeMs, limit);
  if(status !== OK) {
    console.error('Failed to archive entries with status', status);
    store.close();
    return status;
  }

  store.close();
  return OK;
};

cli.pollFeeds = async function() {
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
  const store = new FeedStore();
  let status = await store.open();
  if(status !== OK) {
    console.error('Failed to open database with status', status);
    return status;
  }

  status = await store.removeLostEntries(limit);
  if(status !== OK) {
    console.error('Failed to remove lost entries with status ' + status);
    store.close();
    return status;
  }

  store.close();
  return OK;
};

cli.removeOrphanedEntries = async function(limit) {
  const store = new FeedStore();
  let status = await store.open();
  if(status !== OK) {
    console.error('Failed to open database with status', status);
    return status;
  }

  status = await store.removeOrphanedEntries(limit);
  if(status !== OK) {
    console.error('Failed to remove orphaned entries with status', status);
    store.close();
    return status;
  }

  store.close();
  return OK;
};

cli.clearFavicons = async function() {
  const cache = new FaviconCache();
  let status = await cache.open();
  if(status !== OK) {
    console.error('Failed to open favicon cache with status', status);
    return status;
  }

  status = await cache.clear();
  if(status !== OK) {
    console.error('Failed to clear favicon cache with status', status);
    cache.close();// ignore failure here
    return status;
  }

  return cache.close();
};

cli.compactFavicons = async function(limit) {
  const cache = new FaviconCache();
  let status = await cache.open();
  if(status !== OK) {
    console.error('Failed to open database with status', status);
    return status;
  }

  let maxAgeMs;
  status = await cache.compact(maxAgeMs, limit);
  if(status !== OK) {
    console.error('Failed to compact with status', status);
    cache.close();
    return status;
  }

  cache.close();
  return OK;
};

cli.lookupFavicon = async function(url, timeout, cacheless = true) {
  const query = new FaviconLookup();
  query.cache = new FaviconCache();
  query.fetchHTMLTimeoutMs = timeout;

  try {
    if(!cacheless) {
      await query.cache.open();
    }

    return await query.lookup(new URL(url));
  } finally {
    if(!cacheless) {
      query.cache.close();
    }
  }
};

// Expose cli to console
window.cli = cli;



console.debug('Initializing background page');

addInstallListener(async function(event) {
  console.debug('onInstalled', event);

  // TODO: these tasks are independent, why make the second wait on the first to resolve?

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



addBadgeClickListener(function(event) {
  showSlideshowTab();
});

updateBadgeText();

chrome.alarms.onAlarm.addListener(onWakeup);
chrome.alarms.create('archive', {periodInMinutes: 60 * 12});
chrome.alarms.create('poll', {periodInMinutes: 60});
chrome.alarms.create('remove-entries-missing-urls', {periodInMinutes: 60 * 24 * 7});
chrome.alarms.create('remove-orphaned-entries', {periodInMinutes: 60 * 24 * 7});
chrome.alarms.create('refresh-feed-icons', {periodInMinutes: 60 * 24 * 7 * 2});
chrome.alarms.create('compact-favicon-db', {periodInMinutes: 60 * 24 * 7});
