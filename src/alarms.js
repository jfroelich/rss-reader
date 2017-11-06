'use strict';

// import poll/poll.js
// import favicon.js
// import reader-db.js
// import reader-storage.js

async function alarmsOnArchiveAlarm() {
  let conn, maxAgeMs;
  const limit = 500;
  try {
    conn = await readerDbOpen();
    await readerStorageArchiveEntries(conn, maxAgeMs, limit);
  } catch(error) {
    console.warn(error);
  } finally {
    rbl.closeDB(conn);
  }
}

async function alarmsOnCompactFaviconsAlarm() {
  let maxAgeMs, conn;
  try {
    conn = await faviconDbOpen();
    await faviconCompactDb(conn, maxAgeMs);
  } catch(error) {
    console.warn(error);
  } finally {
    rbl.closeDB(conn);
  }
}

async function alarmsOnPollFeedsAlarm() {
  const pfc = new PollFeedsContext();
  try {
    [pfc.readerConn, pfc.iconConn] = await Promise.all([readerDbOpen(),
      faviconDbOpen()]);
    await pollFeeds(pfc);
  } catch(error) {
    console.warn(error);
  } finally {
    rbl.closeDB(pfc.readerConn, pfc.iconConn);
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
    rbl.closeDB(conn);
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
    rbl.closeDB(conn);
  }
}

async function alarmsOnRefreshFeedIconsAlarm() {
  let readerConn, iconConn;
  try {
    [readerConn, iconConn] = await Promise.all([readerDbOpen(),
      faviconDbOpen()]);
    await readerStorageRefreshFeedIcons(readerConn, iconConn);
  } catch(error) {
    console.warn(error);
  } finally {
    rbl.closeDB(readerConn, iconConn);
  }
}

function alarmsOnWakeup(alarm) {
  console.debug('alarmsOnWakeup', alarm.name);

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

function alarmsRegisterAll() {
  chrome.alarms.create('archive', {periodInMinutes: 60 * 12});
  chrome.alarms.create('poll', {periodInMinutes: 60});
  chrome.alarms.create('remove-entries-missing-urls',
    {periodInMinutes: 60 * 24 * 7});
  chrome.alarms.create('remove-orphaned-entries',
    {periodInMinutes: 60 * 24 * 7});
  chrome.alarms.create('refresh-feed-icons',
    {periodInMinutes: 60 * 24 * 7 * 2});
  chrome.alarms.create('compact-favicon-db',
    {periodInMinutes: 60 * 24 * 7});
}

chrome.alarms.onAlarm.addListener(alarmsOnWakeup);

function alarmsOnDOMContentLoaded(event) {
  console.debug('alarmsOnDOMContentLoaded');
  alarmsRegisterAll();
}

// Defer registration until dom content loaded to allow alarmsRegisterAll
// to use external dependencies that may not yet be loaded in script loading
// order.
document.addEventListener('DOMContentLoaded', alarmsOnDOMContentLoaded,
  {once: true});
