import '/src/cli.js';
import '/src/cron.js';
import * as badge from '/src/badge.js';
import {register_install_listener} from '/src/install.js';
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

async function init_badge() {
  badge.refresh_badge(location.pathname);
}

// TODO: somehow do not rebind every page load when not needed

// On module load, register the install listener
register_install_listener();

// On module load, register the badge click listener
badge.register_badge_click_listener(open_view);

// On module load, initialize the unread count
init_badge();
