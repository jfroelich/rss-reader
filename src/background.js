// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Loaded exclusively in the extension's background page.

'use strict';

var lucu = lucu || {};
lucu.background = {};

lucu.background.VIEW_URL = chrome.extension.getURL('slides.html');

lucu.background.onMessage = function(message) {

  if(!Object.prototype.hasOwnProperty.call(message, 'type')) {
    return;
  }

  var handler = lucu.background.MESSAGE_MAP[message.type];
  if(handler) {
    handler(message);
  }
};

lucu.background.updateBadge = function(message) {
  lucu.extension.updateBadge();
};

lucu.background.onImportCompleted = function(message) {
  var notification = (message.feedsAdded || 0) + ' of ';
  notification += (message.feedsProcessed || 0) + ' feeds imported with ';
  notification += message.exceptions ? message.exceptions.length : 0;
  notification += ' error(s).';
  lucu.extension.showNotification(notification);
};

lucu.background.onSubscribe = function(message) {
  lucu.extension.updateBadge();

  if(message.feed) {
    var title = message.feed.title || message.feed.url;
    lucu.extension.showNotification('Subscribed to ' + title);
  }
};

lucu.background.onPollCompleted = function(message) {
  lucu.extension.updateBadge();

  if(message.entriesAdded) {
    lucu.extension.showNotification(message.entriesAdded + ' new articles added.');
  }
};

// NOTE: this must defined after above, which is incredibly annoying. Consider
// lazy-initialization so order does not matter.
lucu.background.MESSAGE_MAP = {
  entryRead: lucu.background.updateBadge,
  importFeedsCompleted: lucu.background.onImportCompleted,
  pollCompleted: lucu.background.onPollCompleted,
  subscribe: lucu.background.onSubscribe,
  unsubscribe: lucu.background.updateBadge
};

/**
 * Called when the extension's icon button is clicked
 * in Chrome's toolbar. Browser action distinguishes it
 * from page action in case page action is eventually
 * added. This tries to not open the extension additional
 * times, but this is not fullproof because the user can
 * open a new tab and copy and paste the url (btw, no
 * defensive code exists for that distaster scenario).
 *
 * NOTE: this should only be called from the background page
 *
 * TODO: whether to reuse the newtab page should possibly
 * be a setting that is disabled by default, so this should
 * be checking if that setting is enabled before querying for
 * the new tab.
 *
 * NOTE: the calls to chrome.tabs here are limited in such a
 * way as to not require the tabs permission. it was
 * required at one point then removed. It is possibly still
 * required but im not seeing it since im in dev context. tabs
 * perm is not decl in manifest.
 */
lucu.background.onBrowserActionClick = function() {
  chrome.tabs.query({'url': lucu.background.VIEW_URL},
    lucu.background.onTabsViewQueried);
};

lucu.background.onTabsViewQueried = function(tabs) {
  if(tabs.length) {
    chrome.tabs.update(tabs[0].id, {active:true});
  } else {
    chrome.tabs.query({url: 'chrome://newtab/'},
      lucu.background.onTabsNewTabQueried);
  }
};

lucu.background.onTabsNewTabQueried = function(tabs) {
  if(tabs.length) {
    // Replace the new tab
    chrome.tabs.update(tabs[0].id, {active:true, url: lucu.background.VIEW_URL});
  } else {
    chrome.tabs.create({url: lucu.background.VIEW_URL});
  }
};

/**
 * Called when any of the extension's alarms wakeup. For the time being
 * this is only the poll alarm.
 *
 * TODO: polling is ambiguous, should use a more specific name
 * NOTE: this all might need to be revised if we end up using per-feed
 * polling, so there is no need to agonize over the details yet.
 */
lucu.background.onAlarm = function(alarm) {
  if('poll' == alarm.name) {
    chrome.permissions.contains({permissions: ['idle']},
      lucu.background.startPollingIfNotPermittedOrIdle);
  } else if('archive' == alarm.name) {
    lucu.background.startArchive();
  }
};

lucu.background.startPollingIfNotPermittedOrIdle = function(permitted) {
  var INACTIVITY_INTERVAL = 60 * 5;

  if(permitted) {
    chrome.idle.queryState(INACTIVITY_INTERVAL,
      lucu.background.startPollingIfIdle);
  } else {
    lucu.poll.start();
  }
};

lucu.background.startArchive = function() {

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

        // TODO: do we need entry.link for anything?

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


};

lucu.background.startPollingIfIdle = function(idleState) {
  if(idleState == 'locked' || idleState == 'idle') {
    lucu.poll.start();
  }
};

lucu.background.onInstalled = function() {

  var manifest = chrome.runtime.getManifest();

  console.info('Installing %s', manifest.name);

  // This also triggers database creation
  lucu.extension.updateBadge();
};

// TODO: is there a way to avoid this being called every time
// the background page is loaded or reloaded?
// This is also calling the function when the extension is
// enabled or disabled.
chrome.runtime.onInstalled.addListener(lucu.background.onInstalled);

chrome.runtime.onMessage.addListener(lucu.background.onMessage);
chrome.alarms.onAlarm.addListener(lucu.background.onAlarm);

chrome.browserAction.onClicked.addListener(lucu.background.onBrowserActionClick);

// Eventually this may be customizable per feed and will
// need to be refactored.
chrome.alarms.create('poll', {periodInMinutes: 20});
chrome.alarms.create('archive', {periodInMinutes: 24 * 60});
