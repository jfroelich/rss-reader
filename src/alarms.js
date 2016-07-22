// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

chrome.alarms.get('archive', function(alarm) {
  if(!alarm) {
    console.debug('Creating archive alarm');
    chrome.alarms.create('archive', {'periodInMinutes': 60});
  }
});

chrome.alarms.get('poll', function(alarm) {
  if(!alarm) {
    console.debug('Creating poll alarm');
    chrome.alarms.create('poll', {'periodInMinutes': 20});
  }
});

function onAlarmListener(alarm) {
  console.debug('Received alarm wakeup', alarm.name);

  const log = new LoggingService(LoggingService.LEVEL_LOG);
  const archiveService = new ArchiveService();
  archiveService.log = log;
  const faviconCache = new FaviconCache('favicon-cache');
  faviconCache.log = log;
  const faviconService = new FaviconService(faviconCache);
  faviconService.log = log;
  const imageDimensionsService = new ImageDimensionsService();
  imageDimensionsService.log = log;
  const pollingService = new PollingService();
  pollingService.log = log;
  pollingService.faviconService = faviconService;
  pollingService.imageDimensionsService = imageDimensionsService;

  if(alarm.name === 'archive') {
    archiveService.start();
  } else if(alarm.name === 'poll') {
    pollingService.start();
  } else {
    console.debug('Unknown alarm', alarm.name);
  }
}

if(!chrome.alarms.onAlarm.hasListener(onAlarmListener)) {
  console.debug('Adding alarm listener');
  chrome.alarms.onAlarm.addListener(onAlarmListener);
}
