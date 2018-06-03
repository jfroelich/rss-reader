import '/src/cli.js';
import '/src/cron.js';
import {init_badge} from '/src/badge.js';
import {register_install_listener} from '/src/install.js';
import {open_view} from '/src/open-view.js';

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

init_badge();
