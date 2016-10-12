// See license.md

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

chrome.alarms.get('refresh-feed-icons', function(alarm) {
  if(!alarm) {
    console.debug('Creating refresh-feed-icons alarm');
    // Run bi-weekly
    chrome.alarms.create('refresh-feed-icons',
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
    const age = 10 * 24 * 60 * 60 * 1000;// 10 days in ms
    const callback = null;
    const db = new FeedDb();
    archiveEntries(db, age, SilentConsole, callback);
  } else if(alarm.name === 'poll') {
    const forceResetLock = false;
    const allowMeteredConnections = false;
    const log = console;// SilentConsole;
    pollFeeds(forceResetLock, allowMeteredConnections, log);
  } else if(alarm.name === 'compact-favicons') {
    const cache = new FaviconCache(SilentConsole);
    compactFavicons(cache, SilentConsole);
  } else if(alarm.name === 'refresh-feed-icons') {
    refreshFeedIcons(SilentConsole);
  } else if(alarm.name === 'healthcheck') {
    HealthCheck.start(SilentConsole);
  } else {
    console.warn('Unknown alarm', alarm.name);
  }
});
