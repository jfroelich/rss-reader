// See license.md

'use strict';

chrome.runtime.onInstalled.addListener(async function(event) {
  console.debug('chrome.runtime.onInstalled'); // Temp, debugging
  const verbose = true;
  let conn;
  try {
    // Create or upgrade the database by connecting to it
    conn = await openReaderDb();
    // Init app badge text
    updateBadgeText(conn, verbose);
  } catch(error) {
    console.warn(error);
  } finally {
    if(conn) {
      conn.close();
    }
  }

  let iconDbName, iconDbVersion;
  try {
    await setupFaviconDb(iconDbName, iconDbVersion, verbose);
  } catch(error) {
    console.warn(error);
  }
});

chrome.browserAction.onClicked.addListener(async function(event) {
  try {
    await showSlideshowTab();
  } catch(error) {
    console.warn(error);
  }
});

chrome.alarms.onAlarm.addListener(function(alarm) {
  console.debug('chrome.alarms.onAlarm', alarm.name);
  switch(alarm.name) {
    case 'archive':
      archiveEntries().catch(console.warn);
      break;
    case 'poll':
      const flags = 0; // all off
      let idlePeriodSeconds, recencyPeriodMillis, fetchFeedTimeoutMillis,
        fetchHTMLTimeoutMillis, fetchImageTimeoutMillis;
      const promise = pollFeeds(idlePeriodSeconds, recencyPeriodMillis,
        fetchFeedTimeoutMillis, fetchHTMLTimeoutMillis,
        fetchImageTimeoutMillis, flags);
      promise.catch(console.warn);
      break;
    case 'remove-entries-missing-urls':
      removeEntriesMissingURLs().catch(console.warn);
      break;
    case 'remove-orphaned-entries':
      removeOrphanedEntries().catch(console.warn);
      break;
    case 'refresh-feed-icons':
      refreshFeedIcons().catch(console.warn);
      break;
    case 'compact-favicon-db':
      let name, version, maxAgeMillis, verbose;
      compactFaviconDb(name, version, maxAgeMillis, verbose).catch(
        console.warn);
      break;
    default:
      console.warn('Unknown alarm:', alarm.name);
      break;
  }
});

chrome.alarms.create('archive', {'periodInMinutes': 60 * 12});
chrome.alarms.create('poll', {'periodInMinutes': 60});
chrome.alarms.create('remove-entries-missing-urls',
  {'periodInMinutes': 60 * 24 * 7});
chrome.alarms.create('remove-orphaned-entries',
  {'periodInMinutes': 60 * 24 * 7});
chrome.alarms.create('refresh-feed-icons',
  {'periodInMinutes': 60 * 24 * 7 * 2});
chrome.alarms.create('compact-favicon-db', {'periodInMinutes': 60 * 24 * 7});
