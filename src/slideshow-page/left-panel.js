import * as config_control from '/src/config/config.js';
import {export_opml} from '/src/export-opml/export-opml.js';
import * as import_opml from '/src/import-opml/import-opml.js';
import * as ls from '/src/ls/ls.js';

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
      import_opml.prompt();
      break;
    case 'menu-option-export':
      export_opml();
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
