import * as app from '/src/app.js';
import * as badge_control from '/src/control/badge-control.js';
import * as config_control from '/src/control/config-control.js';
import * as cron_control from '/src/control/cron-control.js';
import * as install_update_control from '/src/control/install-update-control.js';

async function background_page_channel_onmessage(event) {
  if (!event.isTrusted) {
    return;
  }

  const message = event.data;
  if (!message) {
    return;
  }

  // Look for any messages that may affect the displayed unread count, and if
  // one is found, request the unread count to be updated. This is needed
  // because actions that occur in the background while no views are open would
  // otherwise cause messages to go unheard.
  const badge_types = ['entry-write', 'entry-deleted', 'entry-read'];
  if (badge_types.includes(message.type)) {
    badge_control.refresh(location.pathname);
  }
}

// Persists for the lifetime of the page. Will not prevent the page from
// unloading.
const channel = new BroadcastChannel(localStorage.channel_name);
channel.onmessage = background_page_channel_onmessage;

// Bind alarm listener
// TODO: move to something like cron_control.install_listener
chrome.alarms.onAlarm.addListener(cron_control.alarm_listener);

// Fired when when chrome starts or on chrome user profile switch
chrome.runtime.onStartup.addListener(badge_control.startup_listener);

// Set the config control to listen for install or update events
chrome.runtime.onInstalled.addListener(config_control.install_listener);

// Fired when the extension is first installed, when the extension is updated
// to a new version, and when Chrome is updated to a new version.
// NOTE: this cannot occur from within startup because the binding somehow
// gets lost on reload
chrome.runtime.onInstalled.addListener(install_update_control.oninstalled);

chrome.runtime.onInstalled.addListener(badge_control.install_listener);

// This must occur in module load scope. This is the only way to get it to
// also work on background page reload. It works when only in startup and
// install, but it doesn't then also work on page reload.
chrome.browserAction.onClicked.addListener(app.open_view);
