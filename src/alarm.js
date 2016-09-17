// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var rdr = rdr || {};

// TODO: is there a way to not check alarms per page load
// TODO: is there a way to not rebind onalarm per page load

chrome.alarms.get('archive', function(alarm) {
  if(!alarm) {
    console.debug('Creating archive alarm');
    chrome.alarms.create('archive', {'periodInMinutes': 60 * 12});
  }
});

chrome.alarms.get('poll', function(alarm) {
  if(!alarm) {
    console.debug('Creating poll alarm');
    chrome.alarms.create('poll', {'periodInMinutes': 30});
  }
});

chrome.alarms.get('compact-favicons', function(alarm) {
  if(!alarm) {
    console.debug('Creating compact-favicons alarm');
    chrome.alarms.create('compact-favicons', {'periodInMinutes': 60 * 24 * 7});
  }
});

chrome.alarms.onAlarm.addListener(function(alarm) {
  console.debug('Alarm wakeup', alarm.name);
  if(alarm.name === 'archive') {
    rdr.archiveEntries();
  } else if(alarm.name === 'poll') {
    const forceResetLock = false;
    const allowMeteredConnections = false;
    rdr.pollFeeds(forceResetLock, allowMeteredConnections);
  } else if(alarm.name === 'compact-favicons') {
    rdr.favicon.compact();
  } else {
    console.warn('Unknown alarm', alarm.name);
  }
});
