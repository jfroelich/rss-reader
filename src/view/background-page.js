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
  const badge_types =
      ['entry-created', 'entry-updated', 'entry-deleted', 'entry-read'];
  if (badge_types.includes(message.type)) {
    badge_control.refresh(location.pathname);
  }
}

// Persists for the lifetime of the page. Does not prevent the page from
// unloading.
const channel = new BroadcastChannel('reader');
channel.onmessage = background_page_channel_onmessage;

// Bind alarm listener
// TODO: move to something like cron_control.install_listener
chrome.alarms.onAlarm.addListener(cron_control.alarm_listener);

chrome.runtime.onStartup.addListener(badge_control.startup_listener);

// NOTE: this cannot occur from within startup because the binding somehow
// gets lost on reload
// NOTE: config comes first as others expect config to be setup
chrome.runtime.onInstalled.addListener(config_control.install_listener);
chrome.runtime.onInstalled.addListener(install_update_control.oninstalled);
chrome.runtime.onInstalled.addListener(cron_control.install_listener);
chrome.runtime.onInstalled.addListener(badge_control.install_listener);

// This must occur in module load scope. This is the only way to get it to
// also work on background page reload. It works when only in startup and
// install, but it doesn't then also work on page reload.
chrome.browserAction.onClicked.addListener(app.open_view);
