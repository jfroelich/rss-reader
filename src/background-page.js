import '/src/cli.js';
import '/src/cron.js';
import {init_badge, register_badge_click_listener} from '/src/badge.js';
import {register_install_listener} from '/src/install.js';
import {open_view} from '/src/open-view.js';

// Loaded by background.html, focuses on initialization and binding things

// On module load, register the install listener
// TODO: somehow do not do this on every page load
register_install_listener();

// On module load, register the badge click listener
// TODO: somehow do not do this on every page load
register_badge_click_listener(open_view);

// On module load, initialize the unread count
init_badge();
