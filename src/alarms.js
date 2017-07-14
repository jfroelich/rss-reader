// See license.md

'use strict';

// This file should only be loaded in the background page of the extension.
// In this file, alarms are registered in the browser, and the listeners for
// each alarm are defined.

// Register an alarm for archive entries, once a day
chrome.alarms.create('archive', {'periodInMinutes': 60 * 12});

// React to alarm for archive entries
chrome.alarms.onAlarm.addListener(async function(alarmObject) {
  if(alarmObject.name !== 'archive') {
    return;
  }

  let conn;
  try {
    conn = await db.connect();
    const numEntriesArchived = await operations.archiveEntries(conn);
  } catch(error) {
    console.warn(error);
  } finally {
    if(conn) {
      conn.close();
    }
  }
});

// TODO: where is remove missing entry urls alarm created? should be here

// React to alarm for removing entries missing urls
chrome.alarms.onAlarm.addListener(async function(alarm) {
  if(alarm.name !== 'remove-entries-missing-urls') {
    return;
  }

  console.debug('Received remote-entries-missing-urls alarm wakeup');

  let conn;
  try {
    conn = await db.connect();
    operations.removeEntriesMissingURLs(conn);
  } catch(error) {
    console.warn(error);
  } finally {
    if(conn) {
      conn.close();
    }
  }
});


////////////////////////////////////////////////////////////////////////
// BELOW IS OUTDATED CODE

async function jrPollCreateAlarm(periodInMinutes) {
  const alarm = await getAlarm('poll');
  if(alarm)
    return;
  chrome.alarms.create('poll', {'periodInMinutes': periodInMinutes});
}

function jrPollRegisterAlarmListener() {
  chrome.alarms.onAlarm.addListener(PollingService.onAlarm);
}

async function jrPollOnAlarm(alarm) {
  if(alarm.name !== 'poll')
    return;
  const service = new PollingService();
  try {
    await service.jrPollFeeds();
  } catch(error) {
    console.warn(error);
  }
}



async function jrFeedIconCreateAlarm(periodInMinutes) {
  const alarm = await getAlarm('refresh-feed-icons');
  if(alarm)
    return;
  chrome.alarms.create('refresh-feed-icons',
    {'periodInMinutes': periodInMinutes});
}

function jrFeedIconRegisterAlarmListener() {
  chrome.alarms.onAlarm.addListener(jrFeedIconOnAlarm);
}

async function jrFeedIconOnAlarm(alarm) {
  if(alarm.name !== 'refresh-feed-icons')
    return;

  try {
    await refreshFeedIcons();
  } catch(error) {
    console.warn(error);
  }
}



async jrFaviconCreateAlarm(periodInMinutes) {
  const alarm = await getAlarm('compact-favicons');
  if(alarm)
    return;
  console.debug('Creating alarm compact-favicons');
  chrome.alarms.create('compact-favicons',
    {'periodInMinutes': periodInMinutes});
}

// Handle an alarm event
async jrFaviconOnAlarm(alarm) {
  // This can be called for any alarm, so reject others
  if(alarm.name !== 'compact-favicons')
    return;
  let conn;

  try {
    conn = await favicon.connect();
    await favicon.compact(conn);
  } catch(error) {
    console.warn(error);
  } finally {
    if(conn)
      conn.close();
  }
}

chrome.alarms.onAlarm.addListener(jrFaviconOnAlarm);


// Performs tasks that should only happen in the context of when the
// background page is loaded
async function alarmsOnLoad(event) {

  // Remove missing entries background task
  chrome.alarms.onAlarm.addListener(removeMissingEntriesOnAlarm);




  PollingService.registerAlarmListener();
  FaviconCache.registerAlarmListener();
  try {
    const pollPeriodInMinutes = 60;
    PollingService.createAlarm(pollPeriodInMinutes);

    const compactIconsPeriodInMinutes = 60 * 24 * 7;
    FaviconCache.createAlarm(compactIconsPeriodInMinutes);

    const refreshFeedIconsPeriodInMinutes = 60 * 24 * 7 * 2;
    FeedFavicon.createAlarm(refreshFeedIconsPeriodInMinutes);

    // TODO: add to handler
    let alarm = await getAlarm('remove-orphan-entries');
    if(!alarm) {
      console.debug('Creating remove-orphan-entries alarm');
      chrome.alarms.create('remove-orphan-entries',
        {'periodInMinutes': 60 * 24 * 7});
    }

    alarm = await getAlarm('remove-entries-missing-urls');
    if(!alarm) {
      console.debug('Creating remove-entries-missing-urls alarm');
      chrome.alarms.create('remove-entries-missing-urls',
        {'periodInMinutes': 60 * 24 * 7});
    }
  } catch(error) {
    console.warn(error);
  }
}

document.addEventListener('DOMContentLoaded', alarmsOnLoad, {'once': true});
