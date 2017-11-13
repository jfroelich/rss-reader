'use strict';

import {FaviconCache} from "/src/favicon-cache.js";
import {FaviconLookup} from "/src/favicon-lookup.js";
import {closeDB} from "/src/idb.js";
import {pollFeeds, PollFeedsContext} from "/src/poll/poll-feeds.js";
import {readerDbOpen} from "/src/reader-db.js";
import {
  readerStorageArchiveEntries,
  readerStorageRemoveLostEntries,
  readerStorageRemoveOrphans,
  readerStorageRefreshFeedIcons
} from "/src/reader-storage.js";



async function alarmsOnArchiveAlarm() {
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
}

async function alarmsOnCompactFaviconsAlarm() {
  const cache = new FaviconCache();
  try {
    await cache.open();
    await cache.compact();
  } catch(error) {
    console.warn(error);
  } finally {
    cache.close();
  }
}

async function alarmsOnPollFeedsAlarm() {

  // The cache dependency should be implicit. cache should be a property of a
  // pollFeeds-like object.

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
}

async function alarmsOnRemoveLostEntriesAlarm() {
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
}

async function alarmsOnRemoveOrphansAlarm() {
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
}

async function alarmsOnRefreshFeedIconsAlarm() {

  const fic = new FaviconCache();

  let readerConn, _;
  try {
    [readerConn, _] = await Promise.all([readerDbOpen(), fic.open()]);
    await readerStorageRefreshFeedIcons(readerConn, fic.conn);
  } catch(error) {
    console.warn(error);
  } finally {
    fic.close();
    closeDB(readerConn);
  }
}

function onWakeup(alarm) {
  console.debug('onWakeup', alarm.name);

  switch(alarm.name) {
  case 'archive':
    alarmsOnArchiveAlarm();
    break;
  case 'poll':
    alarmsOnPollFeedsAlarm();
    break;
  case 'remove-entries-missing-urls':
    alarmsOnRemoveLostEntriesAlarm();
    break;
  case 'remove-orphaned-entries':
    alarmsOnRemoveOrphansAlarm();
    break;
  case 'refresh-feed-icons':
    alarmsOnRefreshFeedIconsAlarm();
    break;
  case 'compact-favicon-db':
    alarmsOnCompactFaviconsAlarm();
    break;
  default:
    console.warn('unhandled alarm', alarm.name);
    break;
  }
}

function registerAlarms() {
  chrome.alarms.create('archive', {periodInMinutes: 60 * 12});
  chrome.alarms.create('poll', {periodInMinutes: 60});
  chrome.alarms.create('remove-entries-missing-urls', {periodInMinutes: 60 * 24 * 7});
  chrome.alarms.create('remove-orphaned-entries', {periodInMinutes: 60 * 24 * 7});
  chrome.alarms.create('refresh-feed-icons', {periodInMinutes: 60 * 24 * 7 * 2});
  chrome.alarms.create('compact-favicon-db', {periodInMinutes: 60 * 24 * 7});
}

chrome.alarms.onAlarm.addListener(onWakeup);

function onDOMContentLoaded(event) {
  console.debug('onDOMContentLoaded');
  registerAlarms();
}

// TODO: this deferring no longer makes sense in a module context. But I am not going to change
// the code yet until modules are working.

// Defer registration until dom content loaded to allow registerAlarms
// to use external dependencies that may not yet be loaded in script loading
// order.
document.addEventListener('DOMContentLoaded', onDOMContentLoaded, {once: true});
