// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

chrome.alarms.onAlarm.addListener(function(alarm) {
  'use strict';
  if(alarm.name === 'archive') {
    archiveEntries();
  } else if(alarm.name === 'poll') {
  	pollFeeds();
  }
});

chrome.alarms.create('archive', {periodInMinutes: 24 * 60});
chrome.alarms.create('poll', {periodInMinutes: 20});

// TODO: maybe set the badge text to '?'
// TODO: set localStorage defaults
chrome.runtime.onInstalled.addListener(function(event) {
  'use strict';  
  openDatabaseConnection(function() {});
});

chrome.browserAction.onClicked.addListener(onBadgeClick);
