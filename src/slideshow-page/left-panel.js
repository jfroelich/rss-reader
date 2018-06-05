import {fonts} from '/src/config.js';
import {get_feeds} from '/src/db/get-feeds.js';
import {open_feed_db} from '/src/db/open-feed-db.js';
import {favicon_create_conn} from '/src/favicon.js';
import {import_opml} from '/src/import-opml.js';
import {list_is_empty, list_peek} from '/src/lib/lang/list.js';
import {create_opml_document} from '/src/lib/opml-document.js';
import {page_style_onchange} from '/src/slideshow-page/page-style-onchange.js';

// BUG: something is completely wrong again with the export-opml experience,
// perhaps because of chrome.downloads api usage, but this is somehow producing
// a network error. The file name that appears in the file browser dialog is
// complete garbage; it almost looks like base64 encoding. And the downloaded
// file does not download. This worked in chrome 66 and then stopped working in
// 67 or 68 beta.

// TODO: should not be hardcoding styles
// TODO: anywhere i use css to set something to 0, do not use units, units are
// superfluous when setting to 0

function import_opml_button_onclick(event) {
  const uploader_input = document.createElement('input');
  uploader_input.setAttribute('type', 'file');
  uploader_input.setAttribute('accept', 'text/xml');
  uploader_input.onchange = uploader_input_onchange;
  uploader_input.click();
}

// Fired when user submits file browser dialog
//
// Uses a function-call lifetime channel instead of the page-lifetime channel to
// avoid the no-loopback issue.
//
// TODO: show operation started immediately, before doing any time-consuming
// work
// TODO: after import, visually inform the user that the operation completed
// successfully
// TODO: after import, refresh feed list so that it displays any new feeds, if
// feed list is visible
// TODO: after import, switch to feed list section or at least show a message
// about how the import completed successfully, and perhaps other details such
// as the number of subscriptions added
// TODO: on import error, show a friendly error message
async function uploader_input_onchange(event) {
  console.debug('Received input change event');
  const op = {};
  [op.rconn, op.iconn] = await Promise.all([open_feed_db(), favicon_create_conn()]);
  op.channel = new BroadcastChannel(localStorage.channel_name);
  op.fetch_timeout = 5 * 1000;
  op.import_opml = import_opml;
  await op.import_opml(event.target.files);
  op.rconn.close();
  op.iconn.close();
  op.channel.close();
  console.debug('Completed opml import');
}

// TODO: visual feedback on completion
// TODO: show an error message on error
async function export_button_onclick(event) {
  const title = 'Subscriptions';
  const filename = 'subscriptions.xml';

  const conn = await open_feed_db();
  const feeds = await get_feeds(conn, 'all', false);
  conn.close();
  console.debug('Loaded %d feeds', feeds.length);

  const outlines = feeds.map(create_outline).filter(outline_has_xml_url);
  const opml_document = create_opml_document(outlines, title);

  // TODO: create a 'download-blob' module that exports the helpers defined here
  // and remove them from here. This could be a general library.
  // TODO: using the downloads api might be the source of the current bug. try
  // reverting to the download-by-anchor method.

  console.debug('Downloading file', filename);
  download_blob_using_chrome_api(
      opml_document_to_blob(opml_document), filename);
  console.debug('Export completed');
}

function outline_has_xml_url(outline) {
  return !!outline.xml_url;
}

// Convert a feed format into an outline object
function create_outline(feed) {
  const outline = {};
  outline.type = feed.type;
  if (!list_is_empty(feed.urls)) {
    outline.xml_url = list_peek(feed.urls);
  }

  outline.title = feed.title;
  outline.description = feed.description;
  outline.html_url = feed.link;
  return outline;
}

function opml_document_to_blob(opml_document) {
  const serializer = new XMLSerializer();
  const xml_string = serializer.serializeToString(opml_document);
  return new Blob([xml_string], {type: 'application/xml'});
}

function download_blob_using_anchor(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.setAttribute('download', filename);
  anchor.href = url;
  anchor.click();
  URL.revokeObjectURL();
}

// An alternative to download_blob_using_anchor that avoids the issue introduced
// in Chrome 65 with cross-origin download urls (see Issue #532)
function download_blob_using_chrome_api(blob, filename) {
  const url = URL.createObjectURL(blob);
  const options = {url: url, filename: filename};
  chrome.downloads.download(options);
  URL.revokeObjectURL(url);
}

export function options_menu_show() {
  const menu_options = document.getElementById('left-panel');
  menu_options.style.marginLeft = '0';
  menu_options.style.boxShadow = '2px 0px 10px 2px #8e8e8e';
}

export function options_menu_hide() {
  const menu_options = document.getElementById('left-panel');
  menu_options.style.marginLeft = '-320px';

  // TODO: do I just delete the prop? How to set back to initial or whatever?
  // Is it by setting to 'none' or 'initial' or 'inherit' or something like
  // that?
  menu_options.style.boxShadow = '';
}

// TODO: handling all clicks and then forwarding them to click handler seems
// dumb. I should be ignoring clicks on such buttons. Let them continue
// progation. The buttons should instead have their own handlers.
function options_menu_onclick(event) {
  const option = event.target;
  if (option.localName !== 'li') {
    return;
  }

  switch (option.id) {
    case 'menu-option-subscribe':
      alert('Not yet implemented, subscribe using options page');
      break;
    case 'menu-option-import':
      import_opml_button_onclick(event);
      break;
    case 'menu-option-export':
      export_button_onclick(event);
      break;
    case 'menu-option-header-font':
      break;
    case 'menu-option-body-font':
      break;
    default:
      console.warn('Unhandled menu option click', option.id);
      break;
  }
}

function header_font_menu_init() {
  const menu = document.getElementById('header-font-menu');
  menu.onchange = header_font_menu_onchange;
  const current_header_font = localStorage.HEADER_FONT_FAMILY;
  const default_option = document.createElement('option');
  default_option.value = '';
  default_option.textContent = 'Header Font';
  menu.appendChild(default_option);
  for (const font_name of fonts) {
    const option = document.createElement('option');
    option.value = font_name;
    option.textContent = font_name;
    if (font_name === current_header_font) {
      option.selected = true;
    }
    menu.appendChild(option);
  }
}

function body_font_menu_init() {
  const menu = document.getElementById('body-font-menu');
  menu.onchange = body_font_menu_onchange;
  const current_body_font = localStorage.BODY_FONT_FAMILY;
  const default_option = document.createElement('option');
  default_option.value = '';
  default_option.textContent = 'Body Font';
  menu.appendChild(default_option);
  for (const font_name of fonts) {
    const option = document.createElement('option');
    option.value = font_name;
    option.textContent = font_name;
    if (font_name === current_body_font) {
      option.selected = true;
    }
    menu.appendChild(option);
  }
}


export function header_font_menu_onchange(event) {
  const font_name = event.target.value;
  if (font_name) {
    localStorage.HEADER_FONT_FAMILY = font_name;
  } else {
    delete localStorage.HEADER_FONT_FAMILY;
  }

  page_style_onchange();
}

function body_font_menu_onchange(event) {
  const font_name = event.target.value;
  if (font_name) {
    localStorage.BODY_FONT_FAMILY = font_name;
  } else {
    delete localStorage.BODY_FONT_FAMILY;
  }

  page_style_onchange();
}

// Handle clicks outside of the left panel. The left panel should close by
// clicking anywhere else. So we listen for clicks anywhere, check if the click
// was outside of the left panel, and if so, then hide the left panel. Ignored
// clicks are left as is, and passed along untouched to any other listeners.
// Clicks on the main menu are ignored because that is considered a part of the
// menu structure. Clicks on the left panel are ignored because that should not
// cause the left panel to hide.
function window_onclick(event) {
  const avoided_zone_ids = ['main-menu-button', 'left-panel'];

  if (!avoided_zone_ids.includes(event.target.id) &&
      !event.target.closest('[id="left-panel"]')) {
    const left_panel_element = document.getElementById('left-panel');

    if (left_panel_element.style.marginLeft === '0px') {
      options_menu_hide();
    }
  }

  return true;
}

// Initialize things on module load
const menu_options = document.getElementById('left-panel');
menu_options.onclick = options_menu_onclick;

header_font_menu_init();

body_font_menu_init();

window.addEventListener('click', window_onclick);
