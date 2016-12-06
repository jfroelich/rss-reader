// See license.md

'use strict';

// TODO: move these todos to github issues
// TODO: is there a way to not re-register things on every page load?
// TODO: is there a way to not rebind onalarm per page load
// TODO: is there a non chrome specific way to do alarms? setInterval would
// not allow the page to unload. some way to wakeup page?
// TODO: create a graceful way to rename/remove alarms. Right now if I stop
// using an alarm it remains silently peristent somewhere in chrome.alarms
// internal state, indefinitely.
// TODO: use multiple listeners, so that each alarm can be self registered by
// the thing that needs it, so I don't have to do all the binding here? I'd
// rather divide this up.

async function createOtherAlarms() {

  let alarm = await ExtensionUtils.getAlarm('refresh-feed-icons');
  if(!alarm) {
    console.debug('Creating refresh-feed-icons alarm');
    chrome.alarms.create('refresh-feed-icons',
      {'periodInMinutes': 60 * 24 * 7 * 2});
  }

  // TODO: add to handler
  alarm = await ExtensionUtils.getAlarm('remove-orphan-entries');
  if(!alarm) {
    console.debug('Creating remove-orphan-entries alarm');
    chrome.alarms.create('remove-orphan-entries',
      {'periodInMinutes': 60 * 24 * 7});
  }

  alarm = await ExtensionUtils.getAlarm('remove-entries-missing-urls');
  if(!alarm) {
    console.debug('Creating remove-entries-missing-urls alarm');
    chrome.alarms.create('remove-entries-missing-urls',
      {'periodInMinutes': 60 * 24 * 7});
  }
}





chrome.alarms.onAlarm.addListener(async function(alarm) {
  console.debug('Alarm wakeup', alarm.name);
  if(alarm.name === 'refresh-feed-icons') {
    const ff = new FeedFavicon();
    try {
      let result = await ff.refresh();
    } catch(error) {
      console.warn(error);
    }
  } else if(alarm.name === 'remove-entries-missing-urls') {

    const readerDb = new ReaderDb();
    const entryStore = new EntryStore();
    const entryController = new EntryController(entryStore);
    let conn;

    try {
      conn = await readerDb.connect();
      entryStore.conn = conn;
      entryController.removeEntriesMissingURLs();
    } catch(error) {
      console.warn(error);
    } finally {
      if(conn)
        conn.close();
    }

  } else {
    console.warn('Unknown alarm', alarm.name);
  }
});

chrome.runtime.onInstalled.addListener(async function(event) {
  console.log('Installing extension ...');
  const db = new ReaderDb();
  let conn;
  try {
    // Generally, connect also triggers database upgrade
    conn = await db.connect();
    await Badge.updateUnreadCount(conn);
  } catch(error) {
    console.debug(error);
  } finally {
    if(conn)
      conn.close();
  }
});

// Must wait for load event because Badge.onClick is in a separate js file
// loaded concurrently
function on_bg_loaded() {
  chrome.browserAction.onClicked.addListener(Badge.onClick);

  EntryArchiver.registerAlarmListener();
  PollingService.registerAlarmListener();
  FaviconCache.registerAlarmListener();

  const entryArchiverPeriodInMinutes = 60 * 12;
  EntryArchiver.createAlarm(entryArchiverPeriodInMinutes);

  const pollPeriodInMinutes = 60;
  PollingService.createAlarm(pollPeriodInMinutes);

  const compactIconsPeriod = 60 * 24 * 7;
  FaviconCache.createAlarm(compactIconsPeriod);

  createOtherAlarms();
}

document.addEventListener('DOMContentLoaded', on_bg_loaded, {'once': true});
