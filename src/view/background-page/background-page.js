import * as badge_control from '/src/control/badge.js';
import * as config_control from '/src/control/config.js';
import * as cron_control from '/src/control/cron.js';
import * as extension_tab from '/src/control/extension-tab.js';
import * as db_control from '/src/db/db-control.js';

// Ensure the badge is refreshed when only the background page is loaded
async function channel_onmessage(event) {
  const types =
      ['entry-created', 'entry-updated', 'entry-deleted', 'entry-read'];
  if (event.isTrusted && event.data && types.includes(event.data.type)) {
    badge_control.refresh(location.pathname);
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
chrome.browserAction.onClicked.addListener(extension_tab.open_view);
