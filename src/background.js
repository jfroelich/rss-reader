// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Background lib, only loaded by background page. Registers
// extension listeners

// Generate alarms
chrome.alarms.create('archive', {periodInMinutes: 24 * 60});
chrome.alarms.create('poll', {periodInMinutes: 20});

// General alarm onwakeup dispatcher
chrome.alarms.onAlarm.addListener(function(alarm) {
  if(alarm.name === 'archive') {
    EntryStore.archiveEntries();
  } else if(alarm.name === 'poll') {
    FeedPoll.start();
  }
});

// Called when the extension is installed
// TODO: maybe set the badge text to '0'
// TODO: set localStorage defaults
chrome.runtime.onInstalled.addListener(function(event) {
  console.log('Installing ...');
  Database.open(function(event) {
    // NOOP
  });
});

// React to user clicking on the toolbar button. If the extension is already
// open, switch to it. Otherwise, if the new tab page is present, replace
// it. Otherwise, open a new tab and switch to it.
// TODO: whether to reuse the newtab page should possibly be a setting that
// is disabled by default, so this should be checking if that setting is
// enabled before querying for the new tab.
// NOTE: the calls to chrome.tabs here do not require the tabs permission
// TODO: is the trailing slash necessary for new tab?
chrome.browserAction.onClicked.addListener(function(event) {
  const viewURL = chrome.extension.getURL('slides.html');
  const newTabURL = 'chrome://newtab/';
  chrome.tabs.query({'url': viewURL}, function(tabs) {
    if(tabs.length) {
      chrome.tabs.update(tabs[0].id, {active: true});
    } else {
      chrome.tabs.query({url: newTabURL}, onQueryNewTab);
    }
  });

  function onQueryNewTab(tabs) {
    if(tabs.length) {
      chrome.tabs.update(tabs[0].id, {
        active: true,
        url: viewURL
      });
    } else {
      chrome.tabs.create({url: viewURL});
    }
  }
});
