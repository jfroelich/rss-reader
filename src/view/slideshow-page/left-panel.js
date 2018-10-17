import * as config_control from '/src/control/config-control.js';
import * as config from '/src/control/config.js';
import {export_opml} from '/src/control/export-opml.js';
import * as import_opml from '/src/control/import-opml.js';

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
async function options_menu_onclick(event) {
  const option = event.target;
  if (option.localName !== 'li') {
    return;
  }

  switch (option.id) {
    case 'menu-option-subscribe':
      alert('Not yet implemented, subscribe using options page');
      break;
    case 'menu-option-import':
      import_opml.prompt();
      break;
    case 'menu-option-export':
      const document_title = 'Subscriptions';
      const opml_document = await export_opml(document_title);
      const file_name = 'subscriptions.xml';
      download_opml_document(opml_document, file_name);
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

// Given an opml document, converts it into a file and then triggers the
// download of that file in the browser.
function download_opml_document(opml_document, file_name = 'subs.xml') {
  // Generate a file. Files implement the Blob interface so we really just
  // generate a blob.
  const serializer = new XMLSerializer();
  const xml_string = serializer.serializeToString(opml_document);
  const blob = new Blob([xml_string], {type: 'application/xml'});

  // Download the blob file by simulating an anchor click
  // NOTE: this was broken in Chrome 65 and then fixed. For Chrome 65, using
  // the chrome.downloads technique worked as an alternative, but now that also
  // no longer works, and this anchor strategy works again
  const anchor = document.createElement('a');
  anchor.setAttribute('download', file_name);
  const url = URL.createObjectURL(blob);
  anchor.setAttribute('href', url);
  anchor.click();
  URL.revokeObjectURL(url);
}

function header_font_menu_init(fonts) {
  const menu = document.getElementById('header-font-menu');
  menu.onchange = header_font_menu_onchange;
  const current_header_font = config.read_string('header_font_family');
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
  const current_body_font = config.read_string('body_font_family');
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
  const old_value = config.read_string('header_font_family');
  if (font_name) {
    config.write_string('header_font_family', font_name);
  } else {
    config.remove('header_font_family');
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
  const old_value = config.read_string('body_font_family');
  if (font_name) {
    config.write_string('body_font_family', font_name);
  } else {
    config.remove('body_font_family');
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

  // Load fonts from configuration once for both init helpers
  const fonts = config.read_array('fonts');
  header_font_menu_init(fonts);
  body_font_menu_init(fonts);

  window.addEventListener('click', window_onclick);
}

// Initialize things on module load
leftpanel_init();
