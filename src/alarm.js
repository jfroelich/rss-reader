// See license.md

'use strict';

// TODO: is there a way to not check alarms per page load
// TODO: is there a way to not rebind onalarm per page load
// TODO: is there a non chrome specific way to do alarms? setInterval would
// not allow the page to unload
// TODO: create a graceful way to rename/remove alarms. Right now if I stop
// using an alarm it remains silently peristent somewhere in chrome.alarms
// internal state, indefinitely.
// TODO: is there a way to use multiple listeners, so that each alarm system
// can be self registered by the thing that needs it, so I don't have to do
// all the binding here? I'd rather divide up this file

chrome.alarms.get('archive', function(alarm) {
  if(!alarm) {
    console.debug('Creating archive alarm');
    chrome.alarms.create('archive', {'periodInMinutes': 60 * 12});
  }
});

chrome.alarms.get('poll', function(alarm) {
  if(!alarm) {
    console.debug('Creating poll alarm');
    chrome.alarms.create('poll', {'periodInMinutes': 60});
  }
});

chrome.alarms.get('compact-favicons', function(alarm) {
  if(!alarm) {
    console.debug('Creating compact-favicons alarm');
    chrome.alarms.create('compact-favicons', {'periodInMinutes': 60 * 24 * 7});
  }
});

chrome.alarms.get('refresh-feed-icons', function(alarm) {
  if(!alarm) {
    console.debug('Creating refresh-feed-icons alarm');
    chrome.alarms.create('refresh-feed-icons',
      {'periodInMinutes': 60 * 24 * 7 * 2});
  }
});

chrome.alarms.get('healthcheck', function(alarm) {
  if(!alarm) {
    console.debug('Creating healthcheck alarm');
    chrome.alarms.create('healthcheck', {'periodInMinutes': 60 * 24 * 7});
  }
});

chrome.alarms.onAlarm.addListener(async function(alarm) {
  console.debug('Alarm wakeup', alarm.name);
  if(alarm.name === 'archive') {
    try {
      await archive_entries();
    } catch(error) {
      console.debug(error);
    }
  } else if(alarm.name === 'poll') {
    const force_reset_lock = false;
    const allow_metered = false;
    const ignore_idle_state = false;
    const skip_unmodified_guard = false;
    const log = SilentConsole;
    poll_feeds(force_reset_lock, allow_metered, ignore_idle_state,
      skip_unmodified_guard, log);
  } else if(alarm.name === 'compact-favicons') {
    try {
      await compact_favicons(undefined, SilentConsole);
    } catch(error) {
      console.debug(error);
    }
  } else if(alarm.name === 'refresh-feed-icons') {
    let result = await refresh_feed_icons();
  } else if(alarm.name === 'healthcheck') {
    HealthCheck.start(SilentConsole);
  } else {
    console.warn('Unknown alarm', alarm.name);
  }
});
