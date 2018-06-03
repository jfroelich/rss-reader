import '/src/cli.js';
import '/src/cron.js';
import {refresh_badge} from '/src/badge.js';
import {db_open} from '/src/db/db-open.js';
import {register_install_listener} from '/src/install.js';
import {log} from '/src/log.js';
import {open_view} from '/src/open-view.js';

// TODO: just use console.log directly and decouple from log library, logging
// here does not need to be toggleable

// Loaded exclusively by the background page. This page is loaded via the
// background page instead of directly via the scripts property in the manifest.
// This is because it is a es6 module and es6 modules cannot be specified in the
// scripts array (at least in Chrome 66).
//
// The background.html page is configured as a dynamic page in manifest.json,
// meaning that it will periodically be loaded and then unloaded as needed. In
// other words it is not persistently live for the lifetime of the browser.
//
// Concerned with the following:
// * Handling app installation and updates
// * Exposing cli functionality to the console for the background page
// * Cron jobs (via chrome.alarms)

// On module load, register the install listener
// TODO: somehow do not do this on every page load, no idea how though
register_install_listener();

chrome.browserAction.onClicked.addListener(open_view);

// TODO: move this function definition to badge.js?
async function badge_init() {
  const conn = await db_open();
  refresh_badge(conn).catch(log);
  conn.close();
}

badge_init();
