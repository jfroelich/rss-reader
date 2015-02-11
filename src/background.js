// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

/**
 * Background page module
 */
(function(exports) {
'use strict';

/**
 * Handle messages send to the background page
 */
chrome.runtime.onMessage.addListener(function (message) {

  switch(message.type) {
    case 'entryRead':
      // console.debug('Received message that entry %s was marked as read',
      //   message.entry.id);
      updateBadge();
      break;
    case 'importFeedsCompleted':
      var notification = (message.feedsAdded || 0) + ' of ';
      notification += (message.feedsProcessed || 0) + ' feeds imported with ';
      notification += message.exceptions ? message.exceptions.length : 0;
      notification += ' error(s).';
      showNotification(notification);
      break;
    case 'pollCompleted':
      updateBadge();
      if(!message.entriesAdded) return;
      showNotification(message.entriesAdded + ' new articles added.');
      break;
    case 'subscribe':
      updateBadge();
      if(!message.feed) return;
      var title = message.feed.title || message.feed.url || 'Untitled';
      showNotification('Subscribed to ' + title);
      break;
    case 'unsubscribe':
      updateBadge();
      break;
    case 'displaySettingsChanged':
      // The background page gets notified of this message but does not
      // care. We handle the message case here to avoid spamming
      // the unhandled warning message in the log
      break;
    default:
      console.warn('Unhandled message %o', message);
      break;
  };
});

/**
 * Sets the badge text to a count of unread entries
 */
function updateBadge() {
  var request = indexedDB.open(lucu.DB_NAME, lucu.DB_VERSION);
  request.onerror = console.error;
  request.onblocked = console.error;
  request.onupgradeneeded = lucu.upgradeDatabase;
  request.onsuccess = function (event) {
    var db = event.target.result;
    var index = db.transaction('entry').objectStore('entry').index('unread');
    index.count().onsuccess = setBadgeText;
  };

  function setBadgeText() {
    // TODO: (if count > 999 then '999+' else count.tostring)
    var count = this.result || 0;
    chrome.browserAction.setBadgeText({text: count.toString()});
  }
}

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
  var VIEW_URL = chrome.extension.getURL('slides.html');
  var NEW_TAB_URL = 'chrome://newtab/';
  var query = chrome.tabs.query;
  var update = chrome.tabs.update;
  var create = chrome.tabs.create;

  query({'url': VIEW_URL}, function (tabs) {
    if(tabs.length) {
      // Switch to an existing tab
      update(tabs[0].id, {active:true});
      return;
    }

    query({url: NEW_TAB_URL}, function (tabs) {
      if(tabs.length) {
        // Switch to and replace the New Tab tab
        update(tabs[0].id, {active:true, url: VIEW_URL});
        return;
      }
      // Create and switch to a new tab
      create({url: VIEW_URL});
    });
  });
});

// TODO: is there a way to avoid this being called every time
// the background page is loaded or reloaded, enabled/disabled?
chrome.runtime.onInstalled.addListener(function onInstall() {

  // TODO: trigger database update here, explicitly
  // instead of relying on updateBadge

  // This also triggers database creation
  updateBadge();
});

chrome.alarms.onAlarm.addListener(function onAlarm(alarm) {
  if('poll' == alarm.name) {
    lucu.pollFeeds(navigator);
  } else if('archive' == alarm.name) {
    lucu.archiveFeeds();
  }
});

// TODO: customizable per feed?
chrome.alarms.create('poll', {periodInMinutes: 20});
chrome.alarms.create('archive', {periodInMinutes: 24 * 60});

function showNotification(message) {
  chrome.permissions.contains({permissions: ['notifications']},
    function (permitted) {
      if(!permitted) return;
      chrome.notifications.create('lucubrate', {
        type: 'basic',
        title: chrome.runtime.getManifest().name,
        iconUrl: '/media/rss_icon_trans.gif',
        message: message
      }, function(){});
  });
}

}(this));
