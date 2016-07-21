// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Called by Chrome when an alarm wakes up
// TODO: there is a strange bug, archiveAlarm is never called
// It looks like chrome is not picking up on alarm name changes, it keeps
// calling alarm names i no longer use
// ok it looks like it serializes the alarm when registered, so even if not
// re-registering, it still eventually gets sent to onAlarm. that's why i am
// still seeing unknown alarms
// TODO: think of a way to only bind the listener once. Maybe there is a way
// to lookup a registered alarm and only register if unregistered.
function onAlarm(alarm) {
  console.debug('Received alarm:', alarm.name);
  const archiveService = new ArchiveService();
  archiveService.log = new LoggingService();
  archiveService.log.level = LoggingService.LEVEL_INFO;

  const pollingService = new PollingService();
  pollingService.log = new LoggingService();
  pollingService.log.level = LoggingService.LEVEL_INFO;

  if(alarm.name === 'archive') {
    console.debug('Calling archiveService.start() from alarm wakeup');
    archiveService.start();
  } else if(alarm.name === 'poll') {
    pollingService.start();
  } else {
    console.debug('Unknown alarm', alarm.name);
  }
}

chrome.alarms.create('archive', {'periodInMinutes': 60});
chrome.alarms.create('poll', {'periodInMinutes': 20});
chrome.alarms.onAlarm.addListener(onAlarm);
