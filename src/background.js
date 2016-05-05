// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Background code, should only be included in the extension's background page
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
  console.log('Installing extension ...');
  // Trigger database install or upgrade by opening a connection
  db_open(Background.onInstallConnect);
};

chrome.runtime.onInstalled.addListener(Background.onInstalled);

// TODO: I would like to immediately close the connection.
// TODO: I would like to log an error if a problem occurred, this could be
// the first sign of an installation problem.
Background.onInstallConnect = function(event) {};

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

Background.VIEW_URL = chrome.extension.getURL('slides.html');

// TODO: Something went wrong upgrading from chrome 48 to 49. The query finds
// the existing tab and updates it, but it is never displayed. It finds it
// even where there is no visible matching tab. Also, the first time I
// clicked it, Chrome crashed. Looking at release notes for 50, I am seeing
// that they are mucking with tab management. They definitely broke something
// because this was working for over a year.
// For now, I've disabled the ability to simply re-focus the existing tab and
// I simply open a new tab each time.
Background.onBadgeClick = function() {
  //chrome.tabs.query({'url': viewURL}, Background.onQueryForViewTab);
  const initialTabSettings = {'url': Background.VIEW_URL};
  chrome.tabs.create(initialTabSettings);
};

Background.onQueryForViewTab = function(tabsArray) {
  const didFindOpenViewTab = !!tabsArray.length;
  if(didFindOpenViewTab) {
    const existingTab = tabsArray[0];
    const newSettingsForExistingTab = {'active': true};
    chrome.tabs.update(existingTab.id, newSettingsForExistingTab);
  } else {
    // TODO: is the trailing slash necessary?
    const NEW_TAB_QUERY = {'url': 'chrome://newtab/'};
    chrome.tabs.query(NEW_TAB_QUERY, Background.onQueryForNewTab);
  }
};

Background.onQueryForNewTab = function(tabsArray) {
  const didFindNewTab = !!tabsArray.length;

  if(didFindNewTab) {
    const existingTab = tabsArray[0];
    const newSettingsForExistingTab = {
      'active': true,
      'url': Background.VIEW_URL
    };
    chrome.tabs.update(existingTab.id, newSettingsForExistingTab);
  } else {
    const newViewTabSettings = {'url': Background.VIEW_URL};
    chrome.tabs.create(newViewTabSettings);
  }
};

chrome.browserAction.onClicked.addListener(Background.onBadgeClick);

// Queries storage for currently archivable entries and archives them.
Background.archiveEntries = function() {
  console.log('Archiving entries');
  db_open(Background.onArchiveConnect);
};

// Open a read-write transaction on the entry store and request all entries
// that are not archived and marked as read, and then start iterating.
Background.onArchiveConnect = function(event) {
  if(event.type !== 'success') {
    console.debug(event);
    return;
  }

  const stats = {
    processed: 0,
    archived: 0
  };

  // Open a cursor over all entries that are read and not archived
  const connection = event.target.result;
  const transaction = connection.transaction('entry', 'readwrite');
  transaction.oncomplete = Background.onArchiveComplete.bind(transaction,
    stats);
  const store = transaction.objectStore('entry');
  const index = store.index('archiveState-readState');
  const keyPath = [ENTRY_FLAGS.UNARCHIVED, ENTRY_FLAGS.READ];
  const request = index.openCursor(keyPath);
  request.onsuccess = Background.archiveNextEntry.bind(request, stats);
};

// Check if the entry at the current cursor position should be archived, and if
// so, archive it, and then proceed to the next entry.
Background.archiveNextEntry = function(stats, event) {
  const request = event.target;
  const cursor = request.result;

  // Either no entries found or completed iteration
  if(!cursor) {
    return;
  }

  stats.processed++;

  // 30 days
  const EXPIRES_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

  const entry = cursor.value;

  // TODO: access dateCreated once field is renamed
  // TODO: the object will be a Date object once I make other changes so
  // the calculation here needs to change.

  const ageInMillis = Date.now() - entry.created;
  const shouldArchiveEntry = ageInMillis > EXPIRES_AFTER_MS;

  if(shouldArchiveEntry) {
    const newEntry = Background.toArchivableEntry(entry);

    // Trigger a new request but do not wait for it to complete
    const asyncUpdateRequest = cursor.update(newEntry);

    // Notify listeners of the state change
    const archiveMessage = {
      'type': 'archivedEntry',
      'entryId': entry.id
    };
    chrome.runtime.sendMessage(archiveMessage);

    stats.archived++;
  }

  cursor.continue();
};

// Returns an entry object suitable for storage. This contains only those
// fields that should persist after Background.
Background.toArchivableEntry = function(inputEntry) {
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
};

Background.onArchiveComplete = function(stats, event) {
  console.log('Archived %s of %s entries', stats.archived, stats.processed);
};
