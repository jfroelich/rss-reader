// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: maybe rename this to something like chrome-alarms.js

'use strict';

{ // BEGIN FILE SCOPE

const alarms = new Map();

// TODO: this references a function that may not exist yet so it does not
// work, eg. if poll-feeds.js is included in manifest.json after this file, so
// i need to allow for that to happen. Right now I am being sloppy and just
// including this file at the end of manifest.json's list of js includes

alarms.set('archive', {
  schedule: {periodInMinutes: 24 * 60},
  target: archiveEntries
});

alarms.set('poll', {
  schedule: {periodInMinutes: 20},
  target: pollFeeds
});

function onChromeAlarm(alarm) {
  const details = alarms.get(alarm.name);
  if(!details) {
    console.error('Received unknown alarm name [%s]', alarm.name);
    return;
  }

  // Execute the corresponding function
  details.target();
}

chrome.alarms.onAlarm.addListener(onChromeAlarm);

// Register the alarms
for(let alarmEntry of alarms) {
  chrome.alarms.create(alarmEntry[0], alarmEntry[1].schedule);
}

} // END FILE SCOPE
