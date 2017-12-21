import {queryIdleState} from "/src/platform/platform.js";
import FaviconCache from "/src/favicon/cache.js";
import FaviconLookup from "/src/favicon/lookup.js";
import FeedStore from "/src/feed-store/feed-store.js";
import PollFeeds from "/src/jobs/poll/poll-feeds.js";
import removeLostEntries from "/src/jobs/remove-lost-entries.js";
import removeOrphanedEntries from "/src/jobs/remove-orphaned-entries.js";

// Registers alarms in the extension that run various background jobs. Analogous to cron.

chrome.alarms.onAlarm.addListener(onWakeup);
chrome.alarms.create('archive', {periodInMinutes: 60 * 12});
chrome.alarms.create('poll', {periodInMinutes: 60});
chrome.alarms.create('remove-entries-missing-urls', {periodInMinutes: 60 * 24 * 7});
chrome.alarms.create('remove-orphaned-entries', {periodInMinutes: 60 * 24 * 7});
chrome.alarms.create('refresh-feed-icons', {periodInMinutes: 60 * 24 * 7 * 2});
chrome.alarms.create('compact-favicon-db', {periodInMinutes: 60 * 24 * 7});

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
      await removeLostEntries(fs, limit);
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
      await removeOrphanedEntries(fs, limit);
    } catch(error) {
      console.warn(error);
    } finally {
      fs.close();
    }
    break;
  }
  case 'refresh-feed-icons': {
    const fs = new FeedStore();
    const fc = new FaviconCache();
    const openPromises = [fs.open(), fc.open()];
    try {
      await Promise.all(openPromises);
      await fs.refreshFeedIcons(fc);
    } catch(error) {
      console.warn(error);
    } finally {
      fs.close();
      fc.close();
    }
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

async function handlePollFeedsAlarm(alarm) {
  // If the non-idle restriction is in place, and the computer is not idle, then avoid polling.
  if('ONLY_POLL_IF_IDLE' in localStorage) {
    const idlePeriodSecs = 30;
    const state = await queryIdleState(idlePeriodSecs);
    if(state !== 'locked' || state !== 'idle') {
      console.debug('not idle, avoiding polling');
      return;
    }
  }

  const poll = new PollFeeds();

  poll.init();
  try {
    await poll.open();
    await poll.pollFeeds();
  } finally {
    poll.close();
  }
}
