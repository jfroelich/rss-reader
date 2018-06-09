import {favicon_create_conn} from '/src/favicon.js';
import * as color from '/src/lib/color.js';
import {open_reader_db} from '/src/reader-db.js';

// Bind the install event listener to the browser so that it can hear install
// events
export function register_install_listener() {
  console.debug('Adding onInstalled listener');
  chrome.runtime.onInstalled.addListener(oninstalled);
}

// Handle an install event
async function oninstalled(event) {
  console.debug(
      'Received oninstalled event: previous version %s install reason %s',
      event.previousVersion, event.reason);

  init_localstorage(event.previousVersion);

  // Initialize the app database
  let conn = await open_reader_db();
  conn.close();

  // Initialize the favicon cache
  conn = await favicon_create_conn();
  conn.close();
}

// TODO: this should respect current values. This gets called both on first time
// install, and on upgrade. Currently this always assumes first time install,
// and overwrites everything. Note that this for now would only focus on setting
// a value if not set, not fixing corrupted values. Assume that if a value is
// set it is valid.

// TODO: this should be responsible for handling changes like deprecation of
// an old setting. Old settings should be removed if they exist. Eventually this
// should be based on previousVersion and current version, but for now this can
// be done using lookups.

// Write default values to localStorage
function init_localstorage(previousVersion) {
  // The default background color used by the low-contrast pass
  localStorage.sanitize_document_low_contrast_default_matte = color.WHITE;
  // The maximum number of characters emphasized before unwrapping emphasis
  localStorage.sanitize_document_emphasis_max_length = '200';
  // The maximum number of rows to scan ahead when analyzing tables
  localStorage.sanitize_document_table_scan_max_rows = '20';
  // How long to wait (in ms) before failing when fetching images when setting
  // image sizes
  localStorage.set_image_sizes_timeout = '3000';

  // Database settings
  localStorage.db_name = 'reader';
  localStorage.db_version = '24';
  localStorage.db_open_timeout = '500';

  // App broadcast channel settings
  localStorage.channel_name = 'reader';

  // Using a longer delay than near-0 to increase cancelation frequency. The
  // delay is in milliseconds. Using asap delay (setting delay to 0 or
  // undefined) was leading to obverably nothing getting canceled and everything
  // getting scheduled too quickly and reaching its end of deferrment and
  // starting and therefore everything was running concurrently. So now this
  // imposes a fake delay on unread count updating that is probably higher than
  // the default near-0 delay. I don't think it will be noticeable but not sure.
  // It turns out that the cross-tab channel messages get sent faster than I
  // expected. Comp specs and load might be a factor I am not accounting for.
  localStorage.refresh_badge_delay = '20';

  // Configure the default for the article title maximum length when displayed
  localStorage.article_title_display_max_length = '300';


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
