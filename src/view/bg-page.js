import * as cdb from '/src/core/cdb.js';
import * as config from '/src/core/config.js';
import * as cron_control from '/src/core/cron.js';
import * as extension from '/src/core/extension.js';
import * as ops from '/src/core/ops.js';

// Open a channel with a lifetime equal to the background page lifetime.
const channel = new BroadcastChannel('reader');
channel.onmessage = async function(event) {
  // Ensure the badge is refreshed when an entry changes and only the background
  // page is loaded
  const types = ['entry-created', 'entry-updated', 'entry-deleted'];
  if (event.isTrusted && event.data && types.includes(event.data.type)) {
    ops.badge_refresh().catch(console.warn);
  }
};

// TODO: re-inline the listener here
chrome.alarms.onAlarm.addListener(cron_control.alarm_listener);

chrome.runtime.onStartup.addListener(event => {
  ops.badge_refresh().catch(console.warn);
});

// TODO: re-inline the listener here
chrome.runtime.onInstalled.addListener(config.install_listener);

chrome.runtime.onInstalled.addListener(async function(event) {
  if (event.reason === 'install') {
    const session = new cdb.CDB();
    await session.open();
    session.close();
  }
});

chrome.runtime.onInstalled.addListener(event => {
  if (event.reason === 'install') {
    cron_control.create_alarms();
  } else {
    cron_control.update_alarms(event.previousVersion);
  }
});

// Refresh for both install and update event types. While it would seem like
// we only need to do this on install, reloading the extension from Chrome's
// extensions page triggers an update event where for some reason the badge
// text is unset.
chrome.runtime.onInstalled.addListener(event => {
  ops.badge_refresh().catch(console.warn);
});

chrome.browserAction.onClicked.addListener(
    event => extension.open_view().catch(console.warn));
