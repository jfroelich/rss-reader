import * as config from '/src/config.js';
import * as cron from '/src/cron.js';
import * as db from '/src/db/db.js';
import { INDEFINITE } from '/src/lib/deadline.js';
import openTab from '/src/lib/open-tab.js';
import refreshBadge from '/src/refresh-badge.js';

function addInstallListener(listener) {
  return chrome.runtime.onInstalled.addListener(listener);
}

function addStartupListener(listener) {
  return chrome.runtime.onStartup.addListener(listener);
}

function addAlarmListener(listener) {
  return chrome.alarms.onAlarm.addListener(listener);
}

function addBadgeListener(listener) {
  return chrome.browserAction.onClicked.addListener(listener);
}

// Open a channel with a lifetime equal to the background page lifetime.
const channel = new BroadcastChannel('reader');
channel.onmessage = function channelOnmessage(event) {
  // Ensure the badge is refreshed when an entry changes and only the background
  // page is loaded
  const types = ['resource-created', 'resource-updated', 'resource-deleted'];
  if (event.isTrusted && event.data && types.includes(event.data.type)) {
    refreshBadge().catch(console.warn);
  }
};

// TODO: re-inline the listener here
addAlarmListener(cron.alarmListener);

function startupListener() {
  refreshBadge().catch(console.warn);
}

addStartupListener(startupListener);

addInstallListener((event) => {
  if (event.reason === 'install') {
    config.init(event);
  } else {
    config.handleUpdate(event);
  }
});

addInstallListener(async (event) => {
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

addInstallListener((event) => {
  if (event.reason === 'install') {
    cron.createAlarms();
  } else {
    cron.updateAlarms(event.previousVersion).catch(console.warn);
  }
});

// Refresh for both install and update event types. While it would seem like
// we only need to do this on install, reloading the extension from Chrome's
// extensions page triggers an update event where for some reason the badge
// text is unset.
function badgeInstallListener() {
  refreshBadge().catch(console.warn);
}

addInstallListener(badgeInstallListener);

addBadgeListener(() => {
  const reuseNewtab = config.readBoolean('reuse_newtab');
  openTab('slideshow.html', reuseNewtab).catch(console.warn);
});
