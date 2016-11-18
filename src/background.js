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
// TODO: use multiple listeners, so that each alarm
// can be self registered by the thing that needs it, so I don't have to do
// all the binding here? I'd rather divide up this file

function get_alarm(alarm_name) {
  return new Promise(function(resolve) {
    chrome.alarms.get(alarm_name, resolve);
  });
}

async function create_alarms() {
  let alarm = await get_alarm('archive');
  if(!alarm) {
    console.debug('Creating archive alarm');
    chrome.alarms.create('archive', {'periodInMinutes': 60 * 12});
  }

  alarm = await get_alarm('poll');
  if(!alarm) {
    console.debug('Creating poll alarm');
    chrome.alarms.create('poll', {'periodInMinutes': 60});
  }

  alarm = await get_alarm('compact-favicons');
  if(!alarm) {
    console.debug('Creating compact-favicons alarm');
    chrome.alarms.create('compact-favicons', {'periodInMinutes': 60 * 24 * 7});
  }

  alarm = await get_alarm('refresh-feed-icons');
  if(!alarm) {
    console.debug('Creating refresh-feed-icons alarm');
    chrome.alarms.create('refresh-feed-icons',
      {'periodInMinutes': 60 * 24 * 7 * 2});
  }

  // TODO: add to handler
  alarm = await get_alarm('remove-orphan-entries');
  if(!alarm) {
    console.debug('Creating remove-orphan-entries alarm');
    chrome.alarms.create('remove-orphan-entries',
      {'periodInMinutes': 60 * 24 * 7});
  }

  alarm = await get_alarm('remove-entries-missing-urls');
  if(!alarm) {
    console.debug('Creating remove-entries-missing-urls alarm');
    chrome.alarms.create('remove-entries-missing-urls',
      {'periodInMinutes': 60 * 24 * 7});
  }
}

create_alarms();

chrome.alarms.onAlarm.addListener(async function(alarm) {
  console.debug('Alarm wakeup', alarm.name);
  if(alarm.name === 'archive') {
    const db = new ReaderDb();
    let conn;
    try {
      conn = await db.connect();
      await archive_entries(conn);
    } catch(error) {
      console.warn(error);
    } finally {
      if(conn)
        conn.close();
    }
  } else if(alarm.name === 'poll') {
    const pollService = new PollingService();
    pollService.log = console;
    try {
      await pollService.pollFeeds();
    } catch(error) {
      console.warn(error);
    }
  } else if(alarm.name === 'compact-favicons') {
    const fc = new FaviconCache();
    try {
      await fc.connect();
      await fc.compact();
    } catch(error) {
      console.warn(error);
    } finally {
      fc.close();
    }
  } else if(alarm.name === 'refresh-feed-icons') {
    try {
      let result = await refresh_feed_icons();
    } catch(error) {
      console.debug(error);
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

// Must wait for dom to load because Badge.onClick is in a separate js file
function on_bg_loaded() {
  chrome.browserAction.onClicked.addListener(Badge.onClick);
}

document.addEventListener('DOMContentLoaded', on_bg_loaded, {'once': true});
