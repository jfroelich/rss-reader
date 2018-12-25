import * as badge_control from '/src/badge.js';
import * as config_control from '/src/config-control.js';
import * as cron_control from '/src/cron.js';
import * as db_control from '/src/db/db-control.js';
import * as extension_tab from '/src/tab.js';

// TODO: there is a problem with the db install listener, it gets loaded too
// later or maybe the timeout is not being followed, hard to tell, but i think
// something else is doing a database call earlier maybe that imposes a timeout,
// but as a result, what happens right now is there is an error on startup about
// how the database failed to open in time. This is even though the upgrade
// eventually works (because I do not cancel upgradeneeded txn when time out).
// While it is in a sense harmless, it is just wrong and should be somehow
// fixed. I think one step would be to inline it again here, and deprecate
// the db-control thing.

// Ensure the badge is refreshed when only the background page is loaded
async function channel_onmessage(event) {
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
chrome.browserAction.onClicked.addListener(extension_tab.open_view);
