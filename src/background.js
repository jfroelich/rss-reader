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

// TODO: whether to reuse the newtab page should possibly be a setting that
// is disabled by default, so this should be checking if that setting is
// enabled before querying for the new tab.
// NOTE: the calls to chrome.tabs here do not require the tabs permission
chrome.browserAction.onClicked.addListener(function(event) {
  'use strict';
  const VIEW_URL = chrome.extension.getURL('slides.html');
  // TODO: is the trailing slash necessary?
  const NEW_TAB_URL = 'chrome://newtab/';
  chrome.tabs.query({'url': VIEW_URL}, onQueryView);

  function onQueryView(tabs) {
    if(tabs.length) {
      chrome.tabs.update(tabs[0].id, {active: true});
      return;
    }

    chrome.tabs.query({url: NEW_TAB_URL}, onQueryNewTab);
  }

  function onQueryNewTab(tabs) {
    if(tabs.length) {
      chrome.tabs.update(tabs[0].id, {active:true, url: VIEW_URL});
      return;
    }

    chrome.tabs.create({url: VIEW_URL});
  }
});


