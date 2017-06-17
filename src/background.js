// See license.md

// TODO: this file should probably not exist. It should be broken up into
// distinct coherent modules.
// TODO: more dependency injection and decoupling. Look for uses of "new Object"
// and change them to be parameters where it makes sense

'use strict';

// TODO: now that this deals with only one particular alarm this should be
// changed to a function of that component and then this function should be
// removed from here.
// Should probably take the functionality out of entry controller and move both
// that and this into its own file, or as a part of some more general file
// containing background tasks. The organizing principle isn't the timing
// of the events or that it is a background thing, it is the purpose of the
// functionality, which is to cleanup entries
async function jrBgOnAlarm(alarm) {
  if(alarm.name === 'remove-entries-missing-urls') {
    console.debug('Received remote-entries-missing-urls alarm wakeup');
    const readerDb = new ReaderDb();
    const entryStore = new EntryStore();
    const entryController = new EntryController(entryStore);
    let conn;
    try {
      conn = await readerDb.jrDbConnect();
      entryStore.conn = conn;
      entryController.jrEntryRemoveMissingURLs();
    } catch(error) {
      console.warn(error);
    } finally {
      if(conn)
        conn.close();
    }
  }
}

chrome.alarms.onAlarm.addListener(jrBgOnAlarm);

// TODO: break this up, have everything responsible for its own binding and
// event handling instead of trying to centralize it. There is no need to
// centralize, it isn't coherent.
async function jrBgOnLoad(event) {

  EntryArchiver.registerAlarmListener();
  PollingService.registerAlarmListener();
  FaviconCache.registerAlarmListener();

  try {
    const entryArchiverPeriodInMinutes = 60 * 12;
    EntryArchiver.createAlarm(entryArchiverPeriodInMinutes);

    const pollPeriodInMinutes = 60;
    PollingService.createAlarm(pollPeriodInMinutes);

    const compactIconsPeriodInMinutes = 60 * 24 * 7;
    FaviconCache.createAlarm(compactIconsPeriodInMinutes);

    const refreshFeedIconsPeriodInMinutes = 60 * 24 * 7 * 2;
    FeedFavicon.createAlarm(refreshFeedIconsPeriodInMinutes);

    // TODO: add to handler
    let alarm = await jrUtilsGetAlarm('remove-orphan-entries');
    if(!alarm) {
      console.debug('Creating remove-orphan-entries alarm');
      chrome.alarms.create('remove-orphan-entries',
        {'periodInMinutes': 60 * 24 * 7});
    }

    alarm = await jrUtilsGetAlarm('remove-entries-missing-urls');
    if(!alarm) {
      console.debug('Creating remove-entries-missing-urls alarm');
      chrome.alarms.create('remove-entries-missing-urls',
        {'periodInMinutes': 60 * 24 * 7});
    }
  } catch(error) {
    console.warn(error);
  }
}

document.addEventListener('DOMContentLoaded', jrBgOnLoad);
