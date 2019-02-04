import * as cdb from '/src/cdb.js';
import * as config_control from '/src/config-control.js';
import * as config from '/src/config.js';
import * as cron_control from '/src/cron.js';
import * as ops from '/src/ops.js';
import * as utils from '/src/utils.js';

// Open a channel with a lifetime equal to the background page lifetime.
const channel = new BroadcastChannel('reader');
channel.onmessage = async function(event) {
  // Ensure the badge is refreshed when only the background page is loaded
  const types =
      ['entry-created', 'entry-updated', 'entry-deleted', 'entry-read'];
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
chrome.runtime.onInstalled.addListener(config_control.install_listener);

chrome.runtime.onInstalled.addListener(async function(event) {
  if (event.reason === 'install') {
    const session = await cdb.open();
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

chrome.browserAction.onClicked.addListener(_ => utils.open_view(config));
