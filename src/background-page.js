import '/src/cli.js';
import '/src/cron.js';
import * as badge from '/src/badge.js';
import {oninstalled} from '/src/install.js';
import {open_view} from '/src/open-view.js';

// Persists for the lifetime of the page. Will not prevent the page from
// unloading.
const channel = new BroadcastChannel(localStorage.channel_name);
channel.onmessage = background_page_channel_onmessage;

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
  const badge_types = ['entry-write', 'entry-deleted', 'entry-marked-read'];
  if (badge_types.includes(message.type)) {
    badge.refresh_badge(location.pathname);
  }
}

function onstartup() {
  console.debug('Received startup event');

  console.debug('Binding browser action click listener in startup listener');
  chrome.browserAction.onClicked.addListener(open_view);

  console.debug('Initializing badge text in startup listener');
  badge.refresh_badge(location.pathname);
}

// Fired when a profile that has this extension installed first starts up
// NOTE: so basically when chrome starts, or on profile switch
console.debug('Binding extension startup listener on background module load');
chrome.runtime.onStartup.addListener(onstartup);

// Fired when the extension is first installed, when the extension is updated
// to a new version, and when Chrome is updated to a new version.
// NOTE: this cannot occur from within startup. For example from a simple
// reload from extensions page, there is no startup, and somehow this binding
// gets lost.
console.debug('Binding extension install listener on background module load');
chrome.runtime.onInstalled.addListener(oninstalled);
