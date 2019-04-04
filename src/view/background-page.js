import * as config from '/src/config.js';
import * as cron_control from '/src/cron.js';
import open from '/src/db/open.js';
import open_view from '/src/extension/open-view.js';
import refresh_badge from '/src/extension/refresh-badge.js';
import {INDEFINITE} from '/src/lib/deadline.js';

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
  const types = ['resource-created', 'resource-updated', 'resource-deleted'];
  if (event.isTrusted && event.data && types.includes(event.data.type)) {
    refresh_badge().catch(console.warn);
  }
};

// TODO: re-inline the listener here
add_alarm_listener(cron_control.alarm_listener);

add_startup_listener(event => {
  refresh_badge().catch(console.warn);
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
    // This is one of the earliest, if not the earliest, calls to open the
    // database once the extension is installed or updated, so we want to
    // allow for the extra time it takes to complete the upgrade, so we do not
    // impose a timeout in this case.
    const timeout = INDEFINITE;
    const conn = await open(timeout);
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
add_install_listener(_ => refresh_badge().catch(console.warn));

add_badge_listener(_ => open_view().catch(console.warn));
