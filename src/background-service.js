// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const BackgroundService = {};

BackgroundService.onBackgroundPageLoad = function(event) {
  chrome.runtime.onInstalled.addListener(BackgroundService.onInstalled);
  chrome.browserAction.onClicked.addListener(BackgroundService.onBadgeClick);

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

  if(!chrome.alarms.onAlarm.hasListener(BackgroundService.onAlarm)) {
    console.debug('Binding alarm listener');
    chrome.alarms.onAlarm.addListener(BackgroundService.onAlarm);
  }
};

BackgroundService.onBackgroundPageLoad();

BackgroundService.onInstalled = function(event) {
  console.log('Installing extension ...');
  const badgeUpdateService = new BadgeUpdateService();
  badgeUpdateService.updateCount();
};

BackgroundService.onBadgeClick = function() {
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

BackgroundService.onAlarm = function(alarm) {
  console.debug('Alarm wakeup', alarm.name);

  const archiveService = new ArchiveService();
  const pollingService = new PollingService();

  if(alarm.name === 'archive') {
    archiveService.start();
  } else if(alarm.name === 'poll') {
    pollingService.start();
  } else {
    console.warn('Unknown alarm', alarm.name);
  }
};
