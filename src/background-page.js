import * as badge from '/src/badge.js';
import * as config from '/src/config/config.js';
import * as cron_control from '/src/cron.js';
import * as extension from '/src/extension.js';
import db_open from '/src/db/ops/db-open.js';

function add_install_listener(listener) {
  return chrome.runtime.onInstalled.addListener(listener);
}

function add_startup_listener(listener) {
  return chrome.runtime.onStartup.addListener(listener);
}

function add_alarm_listener(listener) {
  return chrome.alarms.onAlarm.addListener(listener);
}

function add_badge_listener(listener) {
  return chrome.browserAction.onClicked.addListener(listener);
}

// Open a channel with a lifetime equal to the background page lifetime.
const channel = new BroadcastChannel('reader');
channel.onmessage = function(event) {
  // Ensure the badge is refreshed when an entry changes and only the background
  // page is loaded
  const types = ['entry-created', 'entry-updated', 'entry-deleted'];
  if (event.isTrusted && event.data && types.includes(event.data.type)) {
    badge.badge_refresh().catch(console.warn);
  }
};

// TODO: re-inline the listener here
add_alarm_listener(cron_control.alarm_listener);

add_startup_listener(event => {
  badge.badge_refresh().catch(console.warn);
});

add_install_listener(function(event) {
  if (event.reason === 'install') {
    config.init(event);
  } else {
    config.handle_update(event);
  }
});

add_install_listener(async function(event) {
  if (event.reason === 'install') {
    const conn = await db_open();
    conn.close();
  }
});

add_install_listener(event => {
  if (event.reason === 'install') {
    cron_control.create_alarms();
  } else {
    cron_control.update_alarms(event.previousVersion).catch(console.warn);
  }
});

// Refresh for both install and update event types. While it would seem like
// we only need to do this on install, reloading the extension from Chrome's
// extensions page triggers an update event where for some reason the badge
// text is unset.
add_install_listener(_ => badge.badge_refresh().catch(console.warn));

add_badge_listener(_ => extension.open_view().catch(console.warn));
