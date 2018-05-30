import {db_open} from '/src/db/db-open.js';
import {favicon_create_conn} from '/src/favicon.js';
import * as color from '/src/lib/color.js';

// Bind the install event listener to the browser so that it can hear install
// events
export function register_install_listener() {
  console.debug('Binding app install listener:', oninstalled.name);
  chrome.runtime.onInstalled.addListener(oninstalled);
}

// Handle an install event
async function oninstalled(event) {
  console.debug('Received oninstalled event, installing...');
  console.debug('Previous version (?):', event.previousVersion);
  console.debug('Install reason:', event.reason);

  init_localstorage();

  // Initialize the app database
  let conn = await db_open();
  conn.close();

  // Initialize the favicon cache
  conn = await favicon_create_conn();
  conn.close();
}

// Write default values to localStorage
function init_localstorage() {
  console.debug('Initializing local storage...');

  // NOTE: local storage values are strings. This relies on implicit coercion

  // The default background color used by the low-contrast pass
  localStorage.sanitize_document_low_contrast_default_matte = color.WHITE;
  // The maximum number of characters emphasized before unwrapping emphasis
  localStorage.sanitize_document_emphasis_max_length = 200;
  // The maximum number of rows to scan ahead when analyzing tables
  localStorage.sanitize_document_table_scan_max_rows = 20;
  // How long to wait (in ms) before failing when fetching images when setting
  // image sizes
  localStorage.set_image_sizes_timeout = 3000;

  // Database settings
  localStorage.db_name = 'reader';
  localStorage.db_version = 24;
  localStorage.db_open_timeout = 500;

  // App broadcast channel settings
  localStorage.channel_name = 'reader';


  // TODO: the following display configuration properties should also be
  // initialized at this time

  // localStorage.PADDING
  // localStorage.BG_IMAGE
  // localStorage.BG_COLOR
  // localStorage.HEADER_FONT_FAMILY
  // localStorage.HEADER_FONT_SIZE
  // localStorage.BODY_FONT_FAMILY
  // localStorage.BODY_FONT_SIZE
  // localStorage.JUSTIFY_TEXT
  // localStorage.BODY_LINE_HEIGHT
  // localStorage.COLUMN_COUNT
}
