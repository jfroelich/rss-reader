// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Called by Chrome when an alarm wakes up
// TODO: there is a strange bug, archiveAlarm is never called
// Theory 1: something to do with creating the alarm per page load
// Theory 2: erroneously not persisted, never have page open long enough
// Theory 3: creating pollAlarm overwrites archiveAlarm (there can only be one)
// TODO: think of a way to only bind the listener once. Maybe there is a way
// to lookup a registered alarm and only register if unregistered.
function onAlarm(alarm) {
  const archiveService = new ArchiveService();
  archiveService.log = new LoggingService();
  archiveService.log.level = LoggingService.LEVEL_INFO;

  if(alarm.name === 'archive') {
    console.debug('Calling archiveService.start() from alarm wakeup');
    archiveService.start();
  } else if(alarm.name === 'poll') {
    PollingService.start();
  } else {
    console.debug('Unknown alarm', alarm.name);
  }
}

chrome.alarms.create('archive', {'periodInMinutes': 60});
chrome.alarms.create('poll', {'periodInMinutes': 20});
chrome.alarms.onAlarm.addListener(onAlarm);
