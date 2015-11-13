// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

chrome.alarms.create('archive', {periodInMinutes: 24 * 60});
chrome.alarms.create('poll', {periodInMinutes: 20});

chrome.alarms.onAlarm.addListener(function(alarm) {
  if(alarm.name === 'archive') {
    EntryStore.archiveEntries();
  } else if(alarm.name === 'poll') {
    FeedPoll.start();
  }
});

// TODO: maybe set the badge text to '0'
// TODO: set localStorage defaults
chrome.runtime.onInstalled.addListener(function(event) {
  Database.open(function(event) {
    // NOOP
  });
});

chrome.browserAction.onClicked.addListener(BrowserActionUtils.onClicked);
