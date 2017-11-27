import FaviconCache from "/src/favicon/cache.js";
import FaviconLookup from "/src/favicon/lookup.js";
import archiveEntries from "/src/jobs/archive-entries/archive-entries.js";
import {pollFeeds, PollFeedsContext} from "/src/jobs/poll/poll-feeds.js";
import refreshFeedIcons from "/src/jobs/refresh-feed-icons.js";
import removeLostEntries from "/src/jobs/remove-lost-entries.js";
import removeOrphanedEntries from "/src/jobs/remove-orphaned-entries.js";
import openReaderDb from "/src/reader-db/open.js";
import * as idb from "/src/utils/indexeddb-utils.js";

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

  switch(alarm.name) {
  case 'archive': {
    let conn, maxAgeMs;
    const limit = 500;
    try {
      conn = await openReaderDb();
      await archiveEntries(conn, maxAgeMs, limit);
    } catch(error) {
      console.warn(error);
    } finally {
      idb.close(conn);
    }
    break;
  }
  case 'poll':
    // Non-awaited call to async promise-returning function
    handlePollFeedsAlarmWakeup(alarm).catch(console.warn);
    break;
  case 'remove-entries-missing-urls': {
    const limit = 100;
    let conn;
    try {
      conn = await openReaderDb();
      await removeLostEntries(conn, limit);
    } catch(error) {
      console.warn(error);
    } finally {
      idb.close(conn);
    }
    break;
  }
  case 'remove-orphaned-entries': {
    const limit = 100;
    let conn;
    try {
      conn = await openReaderDb();
      await removeOrphanedEntries(conn, limit);
    } catch(error) {
      console.warn(error);
    } finally {
      idb.close(conn);
    }
    break;
  }
  case 'refresh-feed-icons': {
    const fic = new FaviconCache();
    let readerConn;
    try {
      [readerConn] = await Promise.all([openReaderDb(), fic.open()]);
      await refreshFeedIcons(readerConn, fic);
    } catch(error) {
      console.warn(error);
    } finally {
      fic.close();
      idb.close(readerConn);
    }
    break;
  }
  case 'compact-favicon-db': {
    const cache = new FaviconCache();
    try {
      await cache.open();
      await cache.compact();
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

async function handlePollFeedsAlarmWakeup(alarm) {
  // If the non-idle restriction is in place, and the computer is not idle, then avoid polling.
  if('ONLY_POLL_IF_IDLE' in localStorage) {
    const idlePeriodSecs = 30;
    const state = await queryIdleState(idlePeriodSecs);
    if(state !== 'locked' || state !== 'idle') {
      console.debug('not idle, avoiding polling');
      return;
    }
  }

  const faviconCache = new FaviconCache();
  const pfc = new PollFeedsContext();
  pfc.iconCache = faviconCache;
  try {
    [pfc.readerConn] = await Promise.all([openReaderDb(), faviconCache.open()]);
    await pollFeeds(pfc);
  } finally {
    faviconCache.close();
    idb.close(pfc.readerConn);
  }
}
