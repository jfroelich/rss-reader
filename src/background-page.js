import {OK} from "/src/common/status.js";
import showSlideshowTab from "/src/show-slideshow-tab.js";
import FaviconCache from "/src/favicon/cache.js";
import FaviconLookup from "/src/favicon/lookup.js";
import FeedPoll from "/src/feed-poll/poll-feeds.js";
import FeedStore from "/src/feed-store/feed-store.js";
import updateBadgeText from "/src/update-badge-text.js";

async function onWakeup(alarm) {
  console.debug('onWakeup', alarm.name);
  localStorage.LAST_ALARM = alarm.name;

  switch(alarm.name) {
  case 'archive': {
    const store = new FeedStore();
    let maxAgeMs;
    const limit = 500;
    try {
      await store.open();
      await store.archiveEntries(maxAgeMs, limit);
    } catch(error) {
      console.warn(error);
    } finally {
      store.close();
    }
    break;
  }
  case 'poll':
    // Non-awaited call to async promise-returning function
    handlePollFeedsAlarm(alarm).catch(console.warn);
    break;
  case 'remove-entries-missing-urls': {
    const fs = new FeedStore();
    const limit = 100;
    try {
      await fs.open();
      await fs.removeLostEntries(limit);
    } catch(error) {
      console.warn(error);
    } finally {
      fs.close();
    }
    break;
  }
  case 'remove-orphaned-entries': {
    const fs = new FeedStore();
    const limit = 100;
    try {
      await fs.open();
      await fs.removeOrphanedEntries(limit);
    } catch(error) {
      console.warn(error);
    } finally {
      fs.close();
    }
    break;
  }
  case 'refresh-feed-icons': {
    handleRefreshFeedIconsAlarm().catch(console.error);
    break;
  }
  case 'compact-favicon-db': {
    const cache = new FaviconCache();
    let maxAgeMs;

    // Hard code a sensible limit on the number of entries processed per alarm wakeup
    // TODO: perhaps this should come from config.js
    const limit = 300;
    try {
      await cache.open();
      await cache.compact(maxAgeMs, limit);
    } catch(error) {
      console.warn(error);
    } finally {
      cache.close();
    }
    break;
  }
  default:
    console.warn('unhandled alarm', alarm.name);
    break;
  }
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

  try {
    status = await fs.refreshFeedIcons(fc);
  } catch(error) {
    console.error(error);
  }

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

  try {
    await Promise.all(promises);
    await fs.refreshFeedIcons(fc);
  } finally {
    fs.close();
    fc.close();
  }
};

cli.archiveEntries = async function(limit) {
  const store = new FeedStore();
  let maxAgeMs;
  try {
    await store.open();
    await store.archiveEntries(maxAgeMs, limit);
  } finally {
    store.close();
  }
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
  try {
    await store.open();
    await store.removeLostEntries(limit);
  } finally {
    store.close();
  }
};

cli.removeOrphanedEntries = async function(limit) {
  const store = new FeedStore();
  try {
    await store.open();
    await store.removeOrphanedEntries(limit);
  } finally {
    store.close();
  }
};

cli.clearFavicons = async function() {
  const cache = new FaviconCache();
  try {
    await cache.open();
    await cache.clear();
  } finally {
    cache.close();
  }
};

cli.compactFavicons = async function(limit) {
  const cache = new FaviconCache();
  let maxAgeMs;
  try {
    await cache.open();
    await cache.compact(maxAgeMs, limit);
  } finally {
    cache.close();
  }
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



console.debug('Initializing background page');

addInstallListener(async function(event) {
  console.debug('onInstalled', event);

  // TODO: these two tasks are independent, why make the second wait on the first to resolve?

  const store = new FeedStore();
  try {
    await store.setup();
  } catch(error) {
    console.warn(error);
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

// Expose to console
window.cli = cli;

chrome.alarms.onAlarm.addListener(onWakeup);
chrome.alarms.create('archive', {periodInMinutes: 60 * 12});
chrome.alarms.create('poll', {periodInMinutes: 60});
chrome.alarms.create('remove-entries-missing-urls', {periodInMinutes: 60 * 24 * 7});
chrome.alarms.create('remove-orphaned-entries', {periodInMinutes: 60 * 24 * 7});
chrome.alarms.create('refresh-feed-icons', {periodInMinutes: 60 * 24 * 7 * 2});
chrome.alarms.create('compact-favicon-db', {periodInMinutes: 60 * 24 * 7});
