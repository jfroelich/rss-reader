import '/src/cli.js';
import '/src/cron.js';
import {refresh_badge, register_badge_click_listener} from '/src/badge.js';
import {register_install_listener} from '/src/install.js';
import {open_view} from '/src/open-view.js';
import {open_reader_db} from '/src/reader-db.js';

// Loaded by background.html, focuses on initialization and binding things

// This channel persists for the lifetime of the background page. Note that I
// verified this opening of a persistent page-lifetime channel does not prevent
// the page from unloading and becoming inactive.
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
  // one is found, request the unread count to be updated.
  const badge_types = ['entry-write', 'entry-deleted', 'entry-marked-read'];
  if (badge_types.includes(message.type)) {
    refresh_badge(window.location.pathname);
  }
}

async function init_badge() {
  refresh_badge(window.location.pathname);
}

// TODO: somehow do not rebind every page load when not needed

// On module load, register the install listener
register_install_listener();

// On module load, register the badge click listener
register_badge_click_listener(open_view);

// On module load, initialize the unread count
init_badge();
