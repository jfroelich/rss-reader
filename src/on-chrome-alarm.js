// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: I do not like how having everything private makes this untestable

'use strict';

{ // BEGIN FILE SCOPE

function onChromeAlarm(alarm) {
  const descriptor = alarms.get(alarm.name);
  if(!descriptor) {
    return;
  }

  const alarmFunction = descriptor.getAlarmFunction();
  alarmFunction();
}

const alarms = new Map();
alarms.set('archive', {
  schedule: {periodInMinutes: 24 * 60},
  getAlarmFunction: function() {
    return archiveEntries;
  }
});
alarms.set('poll', {
  schedule: {periodInMinutes: 20},
  getAlarmFunction: function() {
    return pollFeeds;
  }
});

// Register the listener and the alarms
chrome.alarms.onAlarm.addListener(onChromeAlarm);
for(let alarmEntry of alarms) {
  chrome.alarms.create(alarmEntry[0], alarmEntry[1].schedule);
}

} // END FILE SCOPE
