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
}

if(!chrome.alarms.onAlarm.hasListener(onAlarmListener)) {
  console.debug('Adding alarm listener');
  chrome.alarms.onAlarm.addListener(onAlarmListener);
}
