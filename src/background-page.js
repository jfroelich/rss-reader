import { INDEFINITE } from '/lib/deadline.js';
import * as config from '/src/config.js';
import * as cron from '/src/cron.js';
import * as db from '/src/db/db.js';
import openView from '/src/open-view.js';
import refreshBadge from '/src/refresh-badge.js';

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
channel.onmessage = function (event) {
  // Ensure the badge is refreshed when an entry changes and only the background
  // page is loaded
  const types = ['resource-created', 'resource-updated', 'resource-deleted'];
  if (event.isTrusted && event.data && types.includes(event.data.type)) {
    refreshBadge().catch(console.warn);
  }
};

// TODO: re-inline the listener here
add_alarm_listener(cron.alarm_listener);

add_startup_listener((event) => {
  refreshBadge().catch(console.warn);
});

add_install_listener((event) => {
  if (event.reason === 'install') {
    config.init(event);
  } else {
    config.handleUpdate(event);
  }
});

add_install_listener(async (event) => {
  if (event.reason === 'install') {
    // This is one of the earliest, if not the earliest, calls to open the
    // database once the extension is installed or updated, so we want to
    // allow for the extra time it takes to complete the upgrade, so we do not
    // impose a timeout in this case.
    const timeout = INDEFINITE;
    const conn = await db.open(timeout);
    conn.close();
  }
});

add_install_listener((event) => {
  if (event.reason === 'install') {
    cron.createAlarms();
  } else {
    cron.update_alarms(event.previousVersion).catch(console.warn);
  }
});

// Refresh for both install and update event types. While it would seem like
// we only need to do this on install, reloading the extension from Chrome's
// extensions page triggers an update event where for some reason the badge
// text is unset.
add_install_listener(_ => refreshBadge().catch(console.warn));

add_badge_listener((event) => {
  const reuse_newtab = config.readBoolean('reuse_newtab');
  openView(reuse_newtab).catch(console.warn);
});
