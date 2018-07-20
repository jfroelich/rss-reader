import * as favicon from '/src/favicon/favicon.js';
import {import_opml} from '/src/import-opml.js';
import * as config_control from '/src/config.js';
import * as array from '/src/array.js';
import * as ls from '/src/ls.js';
import {create_opml_document} from '/src/opml-document.js';
import {openModelAccess} from '/src/model/model-access.js';

function import_opml_button_onclick(event) {
  const uploader_input = document.createElement('input');
  uploader_input.setAttribute('type', 'file');
  uploader_input.setAttribute('accept', 'text/xml');
  uploader_input.onchange = uploader_input_onchange;
  uploader_input.click();
}

// Fired when user submits file browser dialog
async function uploader_input_onchange(event) {
  const ma = await openModelAccess(/* channeled */ true);
  await import_opml(ma, event.target.files);
  ma.close();
}

async function export_button_onclick(event) {
  const ma = await openModelAccess(/* channeled */ false);
  const feeds = await ma.getFeeds('all', false);
  ma.close();

  const title = 'Subscriptions';
  const filename = 'subscriptions.xml';

  const outlines = feeds.map(create_outline).filter(outline_has_xml_url);
  const opml_document = create_opml_document(outlines, title);

  // TODO: revert to anchor strategy now that it looks like chrome fixed
  download_blob_using_chrome_api(
      opml_document_to_blob(opml_document), filename);
}

function outline_has_xml_url(outline) {
  return !!outline.xml_url;
}

// Convert a feed format into an outline object
function create_outline(feed) {
  const outline = {};
  outline.type = feed.type;
  if (!array.is_empty(feed.urls)) {
    outline.xml_url = array.peek(feed.urls);
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

function header_font_menu_init(fonts) {
  const menu = document.getElementById('header-font-menu');
  menu.onchange = header_font_menu_onchange;
  const current_header_font = ls.read_string('header_font_family');
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

function body_font_menu_init(fonts) {
  const menu = document.getElementById('body-font-menu');
  menu.onchange = body_font_menu_onchange;
  const current_body_font = ls.read_string('body_font_family');
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
  const old_value = ls.read_string('header_font_family');
  if (font_name) {
    ls.write_string('header_font_family', font_name);
  } else {
    ls.remove('header_font_family');
  }

  // HACK: dispatch a fake local change because storage change event listener
  // only fires if change made from other page
  config_control.storage_onchange({
    isTrusted: true,
    type: 'storage',
    key: 'header_font_family',
    newValue: font_name,
    oldValue: old_value
  });
}

function body_font_menu_onchange(event) {
  const font_name = event.target.value;
  const old_value = ls.read_string('body_font_family');
  if (font_name) {
    ls.write_string('body_font_family', font_name);
  } else {
    ls.remove('body_font_family');
  }

  // HACK: dispatch a fake local change because storage change event listener
  // only fires if change made from other page
  config_control.storage_onchange({
    isTrusted: true,
    type: 'storage',
    key: 'body_font_family',
    newValue: font_name,
    oldValue: old_value
  });
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

function leftpanel_init() {
  const menu_options = document.getElementById('left-panel');
  menu_options.onclick = options_menu_onclick;

  // Load fonts from local storage once for both init helpers
  const fonts = ls.read_array('fonts');
  header_font_menu_init(fonts);
  body_font_menu_init(fonts);

  window.addEventListener('click', window_onclick);
}

// Initialize things on module load
leftpanel_init();
