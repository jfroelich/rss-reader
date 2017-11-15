// Registers alarms in the extension that run various background jobs. Analogous to cron.

import archiveEntries from "/src/archive-entries.js";
import FaviconCache from "/src/favicon-cache.js";
import FaviconLookup from "/src/favicon-lookup.js";
import {pollFeeds, PollFeedsContext} from "/src/poll-feeds.js";
import * as rdb from "/src/rdb.js";
import refreshFeedIcons from "/src/refresh-feed-icons.js";
import removeLostEntries from "/src/remove-lost-entries.js";
import removeOrphanedEntries from "/src/remove-orphaned-entries.js";

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
      conn = await rdb.open();
      await archiveEntries(conn, maxAgeMs, limit);
    } catch(error) {
      console.warn(error);
    } finally {
      rdb.close(conn);
    }
    break;
  }
  case 'poll': {
    const faviconCache = new FaviconCache();
    const pfc = new PollFeedsContext();
    pfc.iconCache = faviconCache;
    let _;
    try {
      [pfc.readerConn, _] = await Promise.all([rdb.open(), faviconCache.open()]);
      await pollFeeds(pfc);
    } catch(error) {
      console.warn(error);
    } finally {
      faviconCache.close();
      rdb.close(pfc.readerConn);
    }
    break;
  }
  case 'remove-entries-missing-urls': {
    const limit = 100;
    let conn;
    try {
      conn = await rdb.open();
      await removeLostEntries(conn, limit);
    } catch(error) {
      console.warn(error);
    } finally {
      rdb.close(conn);
    }
    break;
  }
  case 'remove-orphaned-entries': {
    const limit = 100;
    let conn;
    try {
      conn = await rdb.open();
      await removeOrphanedEntries(conn, limit);
    } catch(error) {
      console.warn(error);
    } finally {
      rdb.close(conn);
    }
    break;
  }
  case 'refresh-feed-icons': {
    const fic = new FaviconCache();
    let readerConn, _;
    try {
      [readerConn, _] = await Promise.all([rdb.open(), fic.open()]);
      await refreshFeedIcons(readerConn, fic.conn);
    } catch(error) {
      console.warn(error);
    } finally {
      fic.close();
      rdb.close(readerConn);
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
