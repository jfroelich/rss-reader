// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

/**
 * Loaded exclusively in the extension's background page. Does not
 * export any functions
 */
(function(exports) {
'use strict';

var MESSAGE_HANDLER_MAP = {
  entryRead: updateBadgeMessage,
  importFeedsCompleted: onImportCompleted,
  pollCompleted: onPollCompleted,
  subscribe: onSubscribe,
  unsubscribe: updateBadgeMessage
};

chrome.runtime.onMessage.addListener(function (message) {
  if(!message || !message.type) return;
  var handler = MESSAGE_HANDLER_MAP[message.type];
  if(!handler) return;
  handler(message);
});

function updateBadgeMessage(message) {
  lucu.extension.updateBadge();
}

function onImportCompleted(message) {
  var notification = (message.feedsAdded || 0) + ' of ';
  notification += (message.feedsProcessed || 0) + ' feeds imported with ';
  notification += message.exceptions ? message.exceptions.length : 0;
  notification += ' error(s).';
  lucu.extension.showNotification(notification);
}

function onSubscribe(message) {
  lucu.extension.updateBadge();
  if(!message.feed) return;
  var title = message.feed.title || message.feed.url || 'Untitled';
  lucu.extension.showNotification('Subscribed to ' + title);
}

function onPollCompleted(message) {
  lucu.extension.updateBadge();
  if(!message.entriesAdded) return;
  lucu.extension.showNotification(message.entriesAdded + ' new articles added.');
}

var VIEW_URL = chrome.extension.getURL('slides.html');
var NEW_TAB_URL = 'chrome://newtab/';

/**
 * Called when the extension's icon button is clicked in Chrome's toolbar.
 * Browser action distinguishes it from page action in case page action is
 * eventually added. This tries to not open the extension additional times,
 * but this is not fullproof because the user can open a new tab and copy
 * and paste the url (btw, no defensive code exists for that distaster
 * scenario).
 * TODO: whether to reuse the newtab page should possibly be a setting that
 * is disabled by default, so this should be checking if that setting is
 * enabled before querying for the new tab.
 * NOTE: the calls to chrome.tabs here do not require the tabs permission
 */
chrome.browserAction.onClicked.addListener(function () {
  chrome.tabs.query({'url': VIEW_URL}, function (tabs) {
    if(tabs.length) {
      chrome.tabs.update(tabs[0].id, {active:true});
    } else {
      chrome.tabs.query({url: NEW_TAB_URL}, function (tabs) {
        if(tabs.length) {
          // Replace the new tab
          chrome.tabs.update(tabs[0].id, {active:true, url: VIEW_URL});
        } else {
          chrome.tabs.create({url: VIEW_URL});
        }
      });
    }
  });
});

// TODO: is there a way to avoid this being called every time
// the background page is loaded or reloaded, enabled/disabled?
chrome.runtime.onInstalled.addListener(function () {
  // This also triggers database creation
  lucu.extension.updateBadge();
});

chrome.alarms.onAlarm.addListener(function (alarm) {
  if('poll' == alarm.name) {
    startPoll();
  } else if('archive' == alarm.name) {
    startArchive();
  }
});

// TODO: customizable per feed?
chrome.alarms.create('poll', {periodInMinutes: 20});
chrome.alarms.create('archive', {periodInMinutes: 24 * 60});

function startPoll() {
  chrome.permissions.contains({permissions: ['idle']}, function (permitted) {
    if(permitted) {
      var INACTIVITY_INTERVAL = 60 * 5;
      chrome.idle.queryState(INACTIVITY_INTERVAL, function (idleState) {
        if(idleState == 'locked' || idleState == 'idle') {
          lucu.poll.start();
        }
      });
    } else {
      lucu.poll.start();
    }
  });
}

function startArchive() {
  lucu.database.open(function(db) {
    var transaction = db.transaction('entry','readwrite');
    var store = transaction.objectStore('entry');
    var expiresMs = 30 * 24 * 60 * 60 * 1000;
    var now = Date.now();
    // We want to instead select only not-archived articles.
    // Otherwise this just repeats itself on the first X entries.
    // So we  pick an index that exists for articles where once
    // archived the article would no longer appear in the index. The
    // index on the feed id for each entry works nicely for this
    // purpose.
    var index = store.index('feed');
    var request = index.openCursor();
    var processed = 0, limit = 1000;
    request.onsuccess = function() {
      var cursor = this.result;
      if(!cursor) return;
      if(processed >= limit) {
        return;
      }

      var entry = cursor.value;
      var created = entry.created;
      if(!created) {
        console.debug('Unknown date created for entry %s, unable to archive', JSON.stringify(entry));
        processed++;
        return cursor.continue();
      }

      // If this happens something is wrong
      if(entry.archiveDate) {
        console.warn('Entry already archived, not re-archiving %s', JSON.stringify(entry));
        processed++;
        return cursor.continue();
      }

      var age = now - created;
      var shouldArchive = age > expiresMs;

      // NOTE: in an old version this used to avoid archiving unread
      // articles. For now this is ignored.

      // NOTE: this used to keep feed id so that unsubscribe
      // would delete archived articles as well. For now I am keeping
      // them around indefinitely. This requires some more thought.
      if(shouldArchive) {
        delete entry.content;
        delete entry.feed;
        delete entry.feedLink;
        delete entry.feedTitle;
        delete entry.pubdate;
        delete entry.readDate;
        delete entry.title;

        // keep entry.id
        // keep entry.link
        // keep entry.hash
        // keep entry.created
        // add in a new date
        entry.archiveDate = now;
        console.debug('Archiving entry with id %s', entry.id);
        cursor.update(entry);
      } else {
        // console.debug('Article too recent to archive %s', entry.id);
      }

      processed++;
      cursor.continue();
    };

    transaction.oncomplete = function() {
      console.debug('Archived %s entries', processed);
    };
  });
}

}(this));
