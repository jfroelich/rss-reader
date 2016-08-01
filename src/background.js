// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const Background = {};

Background.onBackgroundLoad = function(event) {
  chrome.runtime.onInstalled.addListener(Background.onInstalled);
  chrome.browserAction.onClicked.addListener(Background.onBadgeClick);

  chrome.alarms.get('archive', function onGetArchiveAlarm(alarm) {
    if(!alarm) {
      console.debug('Creating archive alarm');
      chrome.alarms.create('archive', {'periodInMinutes': 60});
    }
  });

  chrome.alarms.get('poll', function onGetPollAlarm(alarm) {
    if(!alarm) {
      console.debug('Creating poll alarm');
      chrome.alarms.create('poll', {'periodInMinutes': 20});
    }
  });

  if(!chrome.alarms.onAlarm.hasListener(Background.onAlarm)) {
    console.debug('Binding alarm listener');
    chrome.alarms.onAlarm.addListener(Background.onAlarm);
  }
};

Background.onInstalled = function(event) {
  console.log('Installing extension ...');
  updateBadgeUnreadCount();
};

Background.onBadgeClick = function() {
  const VIEW_URL = chrome.extension.getURL('slides.html');
  chrome.tabs.query({'url': VIEW_URL}, onQueryForViewTab);

  function onQueryForViewTab(tabsArray) {
    if(tabsArray && tabsArray.length) {
      chrome.tabs.update(tabsArray[0].id, {'active': true});
    } else {
      // The trailing slash is required
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

Background.onAlarm = function(alarm) {
  console.debug('Alarm wakeup', alarm.name);
  if(alarm.name === 'archive') {
    archiveEntries();
  } else if(alarm.name === 'poll') {
    const pollingService = new PollingService();
    pollingService.start();
  } else {
    console.warn('Unknown alarm', alarm.name);
  }
};

Background.onBackgroundLoad();
