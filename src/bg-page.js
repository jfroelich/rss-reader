import * as cdb from '/src/cdb.js';
import * as config_control from '/src/config-control.js';
import * as config from '/src/config.js';
import * as cron_control from '/src/cron.js';
import * as ops from '/src/ops.js';
import * as utils from '/src/utils.js';

async function db_install_listener(event) {
  if (event.reason === 'install') {
    const session = await cdb.open();
    session.close();
  }
}

async function channel_onmessage(event) {
  // Ensure the badge is refreshed when only the background page is loaded
  const types =
      ['entry-created', 'entry-updated', 'entry-deleted', 'entry-read'];
  if (event.isTrusted && event.data && types.includes(event.data.type)) {
    ops.badge_refresh();
  }
}

const channel = new BroadcastChannel('reader');
channel.onmessage = channel_onmessage;

chrome.alarms.onAlarm.addListener(cron_control.alarm_listener);

chrome.runtime.onStartup.addListener(event => {
  ops.badge_refresh();
});

// TODO: inline these here again, got carried away with logical cohesion
chrome.runtime.onInstalled.addListener(config_control.install_listener);
chrome.runtime.onInstalled.addListener(db_install_listener);
chrome.runtime.onInstalled.addListener(cron_control.install_listener);

chrome.runtime.onInstalled.addListener(event => {
  // Refresh for both install and update event types. While it would seem like
  // we only need to do this on install, reloading the extension from Chrome's
  // extensions page triggers an update event where for some reason the badge
  // text is unset.
  ops.badge_refresh();
});

chrome.browserAction.onClicked.addListener(_ => utils.open_view(config));
