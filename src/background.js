// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Loaded exclusively in the extension's background page.

'use strict';

function onBackgroundMessage(message) {

  switch(message.type) {
    case 'entryRead':
      updateBadge();
      break;
    case 'importFeedsCompleted':
      backgroundOnImportFeedsCompletedMessage(message);
      break;
    case 'subscribe':
      backgroundOnSubscribeMessage(message);
      break;
    case 'unsubscribe':
      updateBadge();
      break;
    case 'pollCompleted':
      backgroundOnPollCompletedMessage(message);
      break;
    default:
      break;
  }
}

function backgroundOnImportFeedsCompletedMessage(message) {
  var notification = (message.feedsAdded || 0) + ' of ';
  notification += (message.feedsProcessed || 0) + ' feeds imported with ';
  notification += message.exceptions ? message.exceptions.length : 0;
  notification += ' error(s).';
  showNotification(notification);
}

function backgroundOnSubscribeMessage(message) {
  updateBadge();

  if(message.feed) {
    var title = message.feed.title || message.feed.url;
    showNotification('Subscribed to ' + title);
  }
}

function backgroundOnPollCompletedMessage(message) {
  updateBadge();

  if(message.entriesAdded) {
    showNotification(message.entriesAdded + ' new articles added.');
  }
}


var BACKGROUND_VIEW_URL = chrome.extension.getURL('slides.html');

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
function onBrowserActionClick() {
  chrome.tabs.query({'url': BACKGROUND_VIEW_URL}, onTabsViewQueried);
}

function onTabsViewQueried(tabs) {
  if(tabs.length) {
    chrome.tabs.update(tabs[0].id, {active:true});
  } else {
    chrome.tabs.query({url: 'chrome://newtab/'}, onTabsNewTabQueried);
  }
}

function onTabsNewTabQueried(tabs) {
  if(tabs.length) {
    // Replace the new tab
    chrome.tabs.update(tabs[0].id, {active:true, url: BACKGROUND_VIEW_URL});
  } else {
    chrome.tabs.create({url: BACKGROUND_VIEW_URL});
  }
}

/**
 * Called when any of the extension's alarms wakeup. For the time being
 * this is only the poll alarm.
 *
 * TODO: polling is ambiguous, should use a more specific name
 * NOTE: this all might need to be revised if we end up using per-feed
 * polling, so there is no need to agonize over the details yet.
 */
function onBackgroundAlarm(alarm) {
  if('poll' == alarm.name) {
    chrome.permissions.contains({permissions: ['idle']}, startPollingIfNotPermittedOrIdle);
  }
}

function startPollingIfNotPermittedOrIdle(permitted) {
  var INACTIVITY_INTERVAL = 60 * 5;

  if(permitted) {
    chrome.idle.queryState(INACTIVITY_INTERVAL, startPollingIfIdle);
  } else {
    startPolling();
  }
}

function startPollingIfIdle(idleState) {
  if(idleState == 'locked' || idleState == 'idle') {
    startPolling();
  }
}

/**
 * Binds stuff, maybe causes database install/upgrade.
 */
function onExtensionInstalled() {

  var manifest = chrome.runtime.getManifest();

  console.info('Installing %s', manifest.name);

  // This also triggers database creation
  updateBadge();
}

// TODO: is there a way to avoid this being called every time
// the background page is loaded or reloaded?
// This is also calling the function when the extension is
// enabled or disabled.
chrome.runtime.onInstalled.addListener(onExtensionInstalled);

chrome.runtime.onMessage.addListener(onBackgroundMessage);
chrome.alarms.onAlarm.addListener(onBackgroundAlarm);

chrome.browserAction.onClicked.addListener(onBrowserActionClick);

// Eventually this may be customizable per feed and will
// need to be refactored.
chrome.alarms.create('poll', {periodInMinutes: 20});
