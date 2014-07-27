// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Loaded exclusively in the extension's background page.

'use strict';

var lucu = lucu || {};
lucu.background = {};

lucu.background.VIEW_URL = chrome.extension.getURL('slides.html');

lucu.background.MESSAGE_MAP = {
  entryRead: lucu.background.updateBadge,
  importFeedsCompleted: lucu.background.onImportCompleted,
  pollCompleted: lucu.background.onPollCompleted,
  subscribe: lucu.background.onSubscribe,
  unsubscribe: lucu.background.updateBadge
};

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
  updateBadge();
};

lucu.background.onImportCompleted = function(message) {
  var notification = (message.feedsAdded || 0) + ' of ';
  notification += (message.feedsProcessed || 0) + ' feeds imported with ';
  notification += message.exceptions ? message.exceptions.length : 0;
  notification += ' error(s).';
  showNotification(notification);
};

lucu.background.onSubscribe = function(message) {
  updateBadge();

  if(message.feed) {
    var title = message.feed.title || message.feed.url;
    showNotification('Subscribed to ' + title);
  }
};

lucu.background.onPollCompleted = function(message) {
  updateBadge();

  if(message.entriesAdded) {
    showNotification(message.entriesAdded + ' new articles added.');
  }
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
  }
};

lucu.background.startPollingIfNotPermittedOrIdle = function(permitted) {
  var INACTIVITY_INTERVAL = 60 * 5;

  if(permitted) {
    chrome.idle.queryState(INACTIVITY_INTERVAL,
      lucu.background.startPollingIfIdle);
  } else {
    startPolling();
  }
};

lucu.background.startPollingIfIdle = function(idleState) {
  if(idleState == 'locked' || idleState == 'idle') {
    startPolling();
  }
};

lucu.background.onInstalled = function() {

  var manifest = chrome.runtime.getManifest();

  console.info('Installing %s', manifest.name);

  // This also triggers database creation
  updateBadge();
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
