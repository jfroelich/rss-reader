// See license.md

'use strict';

class BackgroundPage {
  static async onAlarm(alarm) {
    console.debug('Alarm wakeup', alarm.name);
    if(alarm.name === 'remove-entries-missing-urls') {
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

    }
  }

  static async onInstalled(event) {
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
  }

  static onLoad(event) {
    console.log('Background page dom content loaded');

    console.log('Registering badge click event listener');
    chrome.browserAction.onClicked.addListener(Badge.onClick);

    console.log('Registering alarm event listeners');
    BackgroundPage.registerAlarmListeners();
    BackgroundPage.createAlarms().catch(function(error) {
      console.warn(error);
    });
  }

  static registerAlarmListeners() {
    EntryArchiver.registerAlarmListener();
    PollingService.registerAlarmListener();
    FaviconCache.registerAlarmListener();
  }

  static async createAlarms() {

    console.log('Creating alarms');
    const entryArchiverPeriodInMinutes = 60 * 12;
    EntryArchiver.createAlarm(entryArchiverPeriodInMinutes);

    const pollPeriodInMinutes = 60;
    PollingService.createAlarm(pollPeriodInMinutes);

    const compactIconsPeriodInMinutes = 60 * 24 * 7;
    FaviconCache.createAlarm(compactIconsPeriodInMinutes);

    const refreshFeedIconsPeriodInMinutes = 60 * 24 * 7 * 2;
    FeedFavicon.createAlarm(refreshFeedIconsPeriodInMinutes);

    // TODO: add to handler
    let alarm = await ExtensionUtils.getAlarm('remove-orphan-entries');
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

  static init() {
    console.log('Initializing background page');

    console.log('Registering general alarm event listener');
    chrome.alarms.onAlarm.addListener(BackgroundPage.onAlarm);

    console.log('Registering install event listener');
    chrome.runtime.onInstalled.addListener(BackgroundPage.onInstalled);

    console.log('Registering dom content load event listener');
    document.addEventListener('DOMContentLoaded', BackgroundPage.onLoad);
  }
}

BackgroundPage.init();
