'use strict';

import FaviconCache from "/src/favicon-cache.js";
import FaviconLookup from "/src/favicon-lookup.js";
import {closeDB} from "/src/idb.js";
import {pollFeeds, PollFeedsContext} from "/src/poll-feeds.js";
import {readerDbOpen} from "/src/reader-db.js";
import {
  readerStorageArchiveEntries,
  readerStorageRemoveLostEntries,
  readerStorageRemoveOrphans
} from "/src/reader-storage.js";
import refreshFeedIcons from "/src/refresh-feed-icons.js";

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
      conn = await readerDbOpen();
      await readerStorageArchiveEntries(conn, maxAgeMs, limit);
    } catch(error) {
      console.warn(error);
    } finally {
      closeDB(conn);
    }
    break;
  }
  case 'poll': {
    const faviconCache = new FaviconCache();
    const pfc = new PollFeedsContext();
    pfc.iconCache = faviconCache;
    let _;
    try {
      [pfc.readerConn, _] = await Promise.all([readerDbOpen(), faviconCache.open()]);
      await pollFeeds(pfc);
    } catch(error) {
      console.warn(error);
    } finally {
      faviconCache.close();
      closeDB(pfc.readerConn);
    }
    break;
  }
  case 'remove-entries-missing-urls': {
    const limit = 100;
    let conn;
    try {
      conn = await readerDbOpen();
      await readerStorageRemoveLostEntries(conn, limit);
    } catch(error) {
      console.warn(error);
    } finally {
      closeDB(conn);
    }
    break;
  }
  case 'remove-orphaned-entries': {
    const limit = 100;
    let conn;
    try {
      conn = await readerDbOpen();
      await readerStorageRemoveOrphans(conn, limit);
    } catch(error) {
      console.warn(error);
    } finally {
      closeDB(conn);
    }
    break;
  }
  case 'refresh-feed-icons': {
    const fic = new FaviconCache();
    let readerConn, _;
    try {
      [readerConn, _] = await Promise.all([readerDbOpen(), fic.open()]);
      await refreshFeedIcons(readerConn, fic.conn);
    } catch(error) {
      console.warn(error);
    } finally {
      fic.close();
      closeDB(readerConn);
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
