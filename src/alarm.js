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
// all the binding here? I'd rather divide up this file

chrome.alarms.get('archive', function(alarm) {
  if(!alarm) {
    console.debug('Creating archive alarm');
    // Run daily
    chrome.alarms.create('archive', {'periodInMinutes': 60 * 12});
  }
});

chrome.alarms.get('poll', function(alarm) {
  if(!alarm) {
    console.debug('Creating poll alarm');
    // Every half hour
    chrome.alarms.create('poll', {'periodInMinutes': 30});
  }
});

chrome.alarms.get('compact-favicons', function(alarm) {
  if(!alarm) {
    console.debug('Creating compact-favicons alarm');
    // Weekly
    chrome.alarms.create('compact-favicons', {'periodInMinutes': 60 * 24 * 7});
  }
});

chrome.alarms.get('refresh-feed-favicons', function(alarm) {
  if(!alarm) {
    console.debug('Creating refresh-feed-favicons alarm');
    // Run bi-weekly
    chrome.alarms.create('refresh-feed-favicons',
      {'periodInMinutes': 60 * 24 * 7 * 2});
  }
});

chrome.alarms.get('healthcheck', function(alarm) {
  if(!alarm) {
    console.debug('Creating healthcheck alarm');
    // Run weekly
    chrome.alarms.create('healthcheck', {'periodInMinutes': 60 * 24 * 7});
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
    const verbose = false;
    rdr.poll.start(verbose, forceResetLock, allowMeteredConnections);
  } else if(alarm.name === 'compact-favicons') {
    const verbose = false;
    rdr.favicon.compact.start(verbose, rdr.favicon.cache.expires);
  } else if(alarm.name === 'healthcheck') {
    const verbose = false;
    rdr.healthcheck.start(verbose);
  } else {
    console.warn('Unknown alarm', alarm.name);
  }
});
