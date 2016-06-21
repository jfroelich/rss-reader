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
    archiveEntries();
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
