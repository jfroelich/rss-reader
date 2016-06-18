// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Background lib for the extension's background page.
// This file should only be included in the background.

const Background = Object.create(null);

// TODO: this is getting called on every background page load. I would
// prefer it did not. Maybe it is because I am calling addListener every
// time?
// TODO: are there any other settings I should be installing?
Background.onInstalled = function(event) {
  console.log('Installing extension ...');
  // Trigger database install or upgrade by opening a connection
  db.open(onConnect);

  // TODO: I would like to immediately close the connection.
  // TODO: I would like to log an error if a problem occurred, this could be
  // the first sign of an installation problem.
  function onConnect(event) {
    const connection = event.target.result;
    utils.updateBadgeUnreadCount(connection);
  }
};

chrome.runtime.onInstalled.addListener(Background.onInstalled);

// Called by Chrome when an alarm wakes up
Background.onAlarm = function(alarm) {
  if(alarm.name === 'archiveAlarm') {
    // TODO: test whether there is ever called, testing with a temporary
    // local storage variable
    // NOTE: I am not seeing it. This is never getting called.
    // Theory 1: something to do with creating the alarm per page load
    // Theory 2: erroneously not persisted, never have page open long enough
    localStorage.ARCHIVE_ALARM_WOKEUP = '' + Date.now();
    Background.archiveEntries();
  } else if(alarm.name === 'pollAlarm') {
    FeedPoller.start();
  }
};

chrome.alarms.create('archiveAlarm', {'periodInMinutes': 24 * 60});
chrome.alarms.create('pollAlarm', {'periodInMinutes': 20});
chrome.alarms.onAlarm.addListener(Background.onAlarm);

// Respond to a click on the extension's icon in Chrome's extension toolbar
Background.onBadgeClick = function() {

  // NOTE: in order to use the url property with chrome.tabs.query, the tabs
  // permission is required, this is the sole reason it is defined within
  // manifest.json. Previously this was not the case, but it looks like Chrome
  // silently changed the requirements without much of a notice, which is
  // why this had stopped working until I re-added the tabs permission.

  const VIEW_URL = chrome.extension.getURL('slides.html');
  chrome.tabs.query({'url': VIEW_URL}, onQueryForViewTab);

  function onQueryForViewTab(tabsArray) {
    if(tabsArray && tabsArray.length) {
      chrome.tabs.update(tabsArray[0].id, {'active': true});
    } else {
      chrome.tabs.query({'url': 'chrome://newtab/'}, onQueryForNewTab);
    }
  }

  function onQueryForNewTab(tabsArray) {
    if(tabsArray && tabsArray.length) {
      chrome.tabs.update(tabsArray[0].id, {'active': true, 'url': VIEW_URL});
    } else {
      chrome.tabs.create({'url': VIEW_URL});
    }
  }
};

chrome.browserAction.onClicked.addListener(Background.onBadgeClick);

// Archives certain entries
Background.archiveEntries = function() {
  console.log('Archiving entries...');

  // Tracking variables that are shared by the nested helper functions
  // and used to log stats
  let processedEntryCount = 0, archivedEntryCount = 0;

  // An entry is considered archivable if it was created more than 10 days
  // ago, among other factors.
  // TODO: it would be cool if this could read in a property set in
  // manifest.js regarding the expiration period instead of hard coding a
  // preference.
  const EXPIRES_AFTER_MS = 10 * 24 * 60 * 60 * 1000;

  db.open(onConnect);

  function onConnect(event) {
    // NOTE: there can be normal cases where this happens. For example, if
    // the request is blocked
    // TODO: should this still call on complete? Should oncomplete accept
    // a parameter indicating success or failure?
    // TODO: rather than log the event, log the error. Is that event.error?
    if(event.type !== 'success') {
      console.debug(event);
      return;
    }

    const connection = event.target.result;
    const transaction = connection.transaction('entry', 'readwrite');
    transaction.oncomplete = onComplete;
    const store = transaction.objectStore('entry');
    const index = store.index('archiveState-readState');
    const keyPath = [db.EntryFlags.UNARCHIVED, db.EntryFlags.READ];
    const request = index.openCursor(keyPath);
    request.onsuccess = processEntryAtCursor;
  }

  // Check if the entry at the current cursor position should be archived, and
  // if so, archive it, and then proceed to the next entry.
  // TODO: access dateCreated once field is renamed
  // TODO: the object will be a Date object once I make other changes so
  // the calculation here needs to change to compare two date objects
  function processEntryAtCursor(event) {
    const request = event.target;
    const cursor = request.result;
    if(cursor) {
      processedEntryCount++;
      const entry = cursor.value;
      const ageInMillis = Date.now() - entry.created;
      if(ageInMillis > EXPIRES_AFTER_MS) {

        const archivedEntry = Object.create(null);
        archivedEntry.id = entry.id;
        archivedEntry.feed = entry.feed;
        archivedEntry.urls = entry.urls;
        archivedEntry.dateArchived = new Date();
        archivedEntry.archiveState = db.EntryFlags.ARCHIVED;

        // TODO: Do I need to also set readState? Perhaps that is implicit
        // in archiveState? Moreover, if that is implicit, why am I
        // using two separate flags instead of just one flag with 3 states? Using
        // one flag would simplify the index keypath and store one less field in
        // the entry store (both pre and post archive transform).
        // I suppose I would also need to think about other things like count
        // of unread and other areas that use the flag. Maybe I should just be
        // using one flag.
        // TODO: if I ever plan to implement a history view where I can see
        // articles read, I should consider maintaining entry.title so that it can
        // appear in the history view. Maybe I also want to add in a 'blurb' that
        // is like HTMLUtils.truncate that shows a bit of the full text of each
        // entry.

        // Note that IDBCursor.prototype.update is async. I am not waiting for
        // it to complete here before continuing.
        cursor.update(archivedEntry);

        // NOTE: this is called prior to the update request completing, meaning
        // listeners are notified while the request is still pending, and even
        // if it may somehow be unsuccessful
        // TODO: use a type like 'archiveEntryRequested' to signal that it is
        // a pending operation
        const archiveMessage = {
          'type': 'archivedEntry',
          'entryId': entry.id
        };
        chrome.runtime.sendMessage(archiveMessage);

        archivedEntryCount++;
      }
      cursor.continue();
    }
  }

  function onComplete(event) {
    console.log('Archived %s of %s entries', archivedEntryCount,
      processedEntryCount);
  }
};
