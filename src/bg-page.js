import * as badge_control from '/src/badge.js';
import * as config_control from '/src/config-control.js';
import * as config from '/src/config.js';
import * as cron_control from '/src/cron.js';
import * as db_control from '/src/db/db-control.js';
import * as utils from '/src/utils.js';

async function channel_onmessage(event) {
  // Ensure the badge is refreshed when only the background page is loaded
  const types =
      ['entry-created', 'entry-updated', 'entry-deleted', 'entry-read'];
  if (event.isTrusted && event.data && types.includes(event.data.type)) {
    badge_control.refresh();
  }
}

const channel = new BroadcastChannel('reader');
channel.onmessage = channel_onmessage;

chrome.alarms.onAlarm.addListener(cron_control.alarm_listener);
chrome.runtime.onStartup.addListener(badge_control.startup_listener);
chrome.runtime.onInstalled.addListener(config_control.install_listener);
chrome.runtime.onInstalled.addListener(db_control.install_listener);
chrome.runtime.onInstalled.addListener(cron_control.install_listener);
chrome.runtime.onInstalled.addListener(badge_control.install_listener);
chrome.browserAction.onClicked.addListener(_ => utils.open_view(config));
