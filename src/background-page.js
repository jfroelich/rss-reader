import '/src/cli.js';
import '/src/cron.js';
import {refresh_badge, register_badge_click_listener} from '/src/badge.js';
import {register_install_listener} from '/src/install.js';
import {open_view} from '/src/open-view.js';
import {open_reader_db} from '/src/reader-db.js';

// Loaded by background.html, focuses on initialization and binding things

async function init_badge() {
  const conn = await open_reader_db();
  refresh_badge(conn).catch(console.error);  // non-blocking
  conn.close();
}

// On module load, register the install listener
register_install_listener();

// On module load, register the badge click listener
register_badge_click_listener(open_view);

// On module load, initialize the unread count
init_badge();
