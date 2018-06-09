import {favicon_create_conn} from '/src/favicon.js';
import * as color from '/src/lib/color.js';
import {localstorage_set_if_undefined} from '/src/lib/localstorage.js';
import {open_reader_db} from '/src/reader-db.js';

// The default set of background images for slides
const background_images = [
  'bgfons-paper_texture318.jpg', 'CCXXXXXXI_by_aqueous.jpg',
  'paper-backgrounds-vintage-white.jpg', 'pickering-texturetastic-gray.png',
  'reusage-recycled-paper-white-first.png', 'subtle-patterns-beige-paper.png',
  'subtle-patterns-cream-paper.png', 'subtle-patterns-exclusive-paper.png',
  'subtle-patterns-groove-paper.png', 'subtle-patterns-handmade-paper.png',
  'subtle-patterns-paper-1.png', 'subtle-patterns-paper-2.png',
  'subtle-patterns-paper.png', 'subtle-patterns-rice-paper-2.png',
  'subtle-patterns-rice-paper-3.png', 'subtle-patterns-soft-wallpaper.png',
  'subtle-patterns-white-wall.png', 'subtle-patterns-witewall-3.png',
  'thomas-zucx-noise-lines.png'
];

// The default set of fonts the user can select from to customize the display of
// text in slides
const fonts = [
  'ArchivoNarrow-Regular', 'Arial', 'Calibri', 'Cambria', 'CartoGothicStd',
  'Edward Tufte Roman', 'Fanwood', 'Georgia', 'League Mono Regular',
  'League Spartan', 'Montserrat', 'Noto Sans', 'Open Sans Regular',
  'PathwayGothicOne', 'PlayfairDisplaySC', 'Roboto Regular'
];

// Bind the install event listener to the browser so that it can hear install
// events
export function register_install_listener() {
  console.debug('Adding onInstalled listener');
  chrome.runtime.onInstalled.addListener(oninstalled);
}

// Handle an install event
async function oninstalled(event) {
  console.debug('previousVersion-reason', event.previousVersion, event.reason);

  init_localstorage(event.previousVersion);

  // Initialize the app database
  let conn = await open_reader_db();
  conn.close();

  // Initialize the favicon cache
  conn = await favicon_create_conn();
  conn.close();
}

function init_localstorage(previousVersion) {
  remove_legacy_localstorage_keys();

  // shorthand
  const s = localstorage_set_if_undefined;

  // The default background color used by the low-contrast pass
  s('sanitize_document_low_contrast_default_matte', color.WHITE);

  // The maximum number of characters emphasized before unwrapping emphasis
  s('sanitize_document_emphasis_max_length', 200);

  // The maximum number of rows to scan ahead when analyzing tables
  s('sanitize_document_table_scan_max_rows', 20);

  // Used by sanitized document, for min contrast ratio
  // TODO: lowercase
  s('MIN_CONTRAST_RATIO', 4.5);

  // How long to wait (in ms) before failing when fetching images when setting
  // image sizes
  s('set_image_sizes_timeout', 3000);

  // Database settings
  s('db_name', 'reader');
  s('db_version', 24);
  s('db_open_timeout', 500);

  // App broadcast channel settings
  s('channel_name', 'reader');

  // Using a longer delay than near-0 to increase cancelation frequency. The
  // delay is in milliseconds. Using asap delay (setting delay to 0 or
  // undefined) was leading to obverably nothing getting canceled and everything
  // getting scheduled too quickly and reaching its end of deferrment and
  // starting and therefore everything was running concurrently. So now this
  // imposes a fake delay on unread count updating that is probably higher than
  // the default near-0 delay. I don't think it will be noticeable but not sure.
  // It turns out that the cross-tab channel messages get sent faster than I
  // expected. Comp specs and load might be a factor I am not accounting for.
  s('refresh_badge_delay', 20);

  // Configure the default for the article title maximum length when displayed
  s('article_title_display_max_length', 300);

  // TODO: the following display configuration properties should also be
  // initialized or possibly updated at this time
  // TODO: once working, then lowercase in a later commit and deprecate upper
  // case keys.

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


  // Background images
  // NOTE: from now on, if images change, this has to also remove/update/etc
  if (typeof localStorage.background_images === 'undefined') {
    localStorage.background_images = JSON.stringify(background_images);
  }

  // Initialize or update font settings
  if (typeof localStorage.fonts === 'undefined') {
    localStorage.fonts = JSON.stringify(fonts);
  }
}

function remove_legacy_localstorage_keys() {
  delete localStorage.debug;
  delete localStorage.refresh_badge_delay;
  delete localStorage.sanitize_document_image_size_fetch_timeout;
}
