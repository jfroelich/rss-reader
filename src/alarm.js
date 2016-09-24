// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: is there a way to not check alarms per page load
// TODO: is there a way to not rebind onalarm per page load
// TODO: create a graceful way to rename/remove alarms. Right now if I stop
// using an alarm it remains silently peristent somewhere in chrome.alarms
// implementation state, indefinitely.
// TODO: is there a way to use multiple listeners, so that each alarm system
// can be self registered by the thing that needs it, so I don't have to do
// all the binding here?

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
    const verbose = false;
    rdr.entry.archive.start(verbose);
  } else if(alarm.name === 'poll') {
    const forceResetLock = false;
    const allowMeteredConnections = false;
    const verbose = true; // in dev
    rdr.poll.start(verbose, forceResetLock, allowMeteredConnections);
  } else if(alarm.name === 'compact-favicons') {
    const verbose = false;
    rdr.favicon.compact.start(verbose, rdr.favicon.cache.expires);
  } else {
    console.warn('Unknown alarm', alarm.name);
  }
});
