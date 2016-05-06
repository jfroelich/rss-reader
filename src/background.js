// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Background lib for the extension's background page. This registers
// listeners in global scope, so this file should only be included in the
// background.

// Requires: /src/db.js
// Requires: /src/poll.js
// Requires: /src/entry.js

const Background = {};

// TODO: this is getting called on every background page load. I would
// prefer it did not. Maybe it is because I am calling addListener every
// time and instead should only be calling it if a listener is not already
// present. So maybe I should search for the listener?
// TODO: are there any other settings I should be installing?
// TODO: initialize unread count
Background.onInstalled = function(event) {

  // TODO: I would like to immediately close the connection.
  // TODO: I would like to log an error if a problem occurred, this could be
  // the first sign of an installation problem.
  function onConnect(event) {
  }

  console.log('Installing extension ...');
  // Trigger database install or upgrade by opening a connection
  db_open(onConnect);
};

chrome.runtime.onInstalled.addListener(Background.onInstalled);

// Called by Chrome when an alarm wakes up
Background.onAlarm = function(alarm) {
  const alarmName = alarm.name;
  if(alarmName === Background.ARCHIVE_ALARM_NAME) {
    Background.archiveEntries();
  } else if(alarmName === Background.POLL_ALARM_NAME) {
    poll_start();
  }
};

Background.ARCHIVE_ALARM_NAME = 'archive';
Background.POLL_ALARM_NAME = 'poll';

chrome.alarms.create(Background.ARCHIVE_ALARM_NAME,
  {'periodInMinutes': 24 * 60});
chrome.alarms.create(Background.POLL_ALARM_NAME, {'periodInMinutes': 20});
chrome.alarms.onAlarm.addListener(Background.onAlarm);

// Respond to a click on the extension's icon in Chrome's extension toolbar
Background.onBadgeClick = function() {

  const VIEW_URL = chrome.extension.getURL('slides.html');

  // TODO: Something went wrong upgrading from chrome 48 to 49. The query finds
  // the existing tab and updates it, but it is never displayed. It finds it
  // even where there is no visible matching tab. Also, the first time I
  // clicked it, Chrome crashed. Looking at release notes for 50, I am seeing
  // that they are mucking with tab management. They definitely broke something
  // because this was working for over a year.
  // For now, I've disabled the ability to simply re-focus the existing tab and
  // I simply open a new tab each time.
  //chrome.tabs.query({'url': viewURL}, onQueryForViewTab);

  const initialTabSettings = {'url': VIEW_URL};
  chrome.tabs.create(initialTabSettings);

  function onQueryForViewTab(tabsArray) {
    const didFindOpenViewTab = !!tabsArray.length;
    if(didFindOpenViewTab) {
      const existingTab = tabsArray[0];
      const newSettingsForExistingTab = {'active': true};
      chrome.tabs.update(existingTab.id, newSettingsForExistingTab);
    } else {
      // TODO: is the trailing slash necessary?
      const NEW_TAB_QUERY = {'url': 'chrome://newtab/'};
      chrome.tabs.query(NEW_TAB_QUERY, onQueryForNewTab);
    }
  }

  function onQueryForNewTab(tabsArray) {
    const didFindNewTab = !!tabsArray.length;

    if(didFindNewTab) {
      const existingTab = tabsArray[0];
      const newSettingsForExistingTab = {
        'active': true,
        'url': VIEW_URL
      };
      chrome.tabs.update(existingTab.id, newSettingsForExistingTab);
    } else {
      const newViewTabSettings = {'url': VIEW_URL};
      chrome.tabs.create(newViewTabSettings);
    }
  }
};

chrome.browserAction.onClicked.addListener(Background.onBadgeClick);

// Archives certain read entries
// TODO: it would be cool if this could read in a property set in manifest.js
// regarding the expiration period instead of hard coding a preference.
Background.archiveEntries = function() {
  console.log('Archiving entries');
  let processedEntryCount = 0, archivedEntryCount = 0;
  db_open(onConnect);

  function onConnect(event) {
    if(event.type !== 'success') {
      console.debug(event);
      return;
    }

    const connection = event.target.result;
    const transaction = connection.transaction('entry', 'readwrite');
    transaction.oncomplete = onComplete;
    const store = transaction.objectStore('entry');
    const index = store.index('archiveState-readState');
    const keyPath = [ENTRY_FLAGS.UNARCHIVED, ENTRY_FLAGS.READ];
    const request = index.openCursor(keyPath);
    request.onsuccess = archiveNextEntry;
  }

  function onComplete(event) {
    console.log('Archived %s of %s entries', archivedEntryCount,
      processedEntryCount);
  }

  // Check if the entry at the current cursor position should be archived, and
  // if so, archive it, and then proceed to the next entry.
  function archiveNextEntry(event) {
    const request = event.target;
    const cursor = request.result;

    // Either no entries found or completed iteration
    if(!cursor) {
      return;
    }

    processedEntryCount++;

    // 10 days
    const EXPIRES_AFTER_MS = 10 * 24 * 60 * 60 * 1000;

    const entry = cursor.value;

    // TODO: access dateCreated once field is renamed
    // TODO: the object will be a Date object once I make other changes so
    // the calculation here needs to change to compare two date objects

    const ageInMillis = Date.now() - entry.created;
    const shouldArchiveEntry = ageInMillis > EXPIRES_AFTER_MS;

    if(shouldArchiveEntry) {
      const newEntry = toArchivableEntry(entry);

      // Trigger a new request but do not wait for it to complete
      const asyncUpdateRequest = cursor.update(newEntry);

      // Notify listeners of the state change (even if its still pending)
      const archiveMessage = {
        'type': 'archivedEntry',
        'entryId': entry.id
      };
      chrome.runtime.sendMessage(archiveMessage);

      archivedEntryCount++;
    }

    cursor.continue();
  }

  // Returns an entry object suitable for storage. This contains only those
  // fields that should persist after archival.
  function toArchivableEntry(inputEntry) {
    const outputEntry = {};

    // Maintain id because it is required to uniquely identify and reference
    // entries in the store.
    outputEntry.id = inputEntry.id;

    // Maintain feed id because we need to be able to remove archived entries
    // as a result of unsubscribing from a feed.
    outputEntry.feed = inputEntry.feed;

    // Maintain link because we still want to represent that the entry already
    // exists when comparing a new entry to existing entries.
    outputEntry.link = inputEntry.link;

    // NOTE: this was previously named archiveDate, some entries currently
    // exist in my testing storage with the old field and not the new field.
    // NOTE: this previously used a timestamp instead of a Date object.
    // TODO: I need to reset the database and then I can delete this comment.
    outputEntry.dateArchived = new Date();

    outputEntry.archiveState = ENTRY_FLAGS.ARCHIVED;
    return outputEntry;
  }
};
