import {log} from '/src/log.js';
import {export_menu_option_handle_click} from '/src/slideshow-page/export-menu-option-onclick.js';
import {import_menu_option_onclick} from '/src/slideshow-page/import-menu-option-onclick.js';

// TODO: should not be hardcoding styles

export function options_menu_show() {
  const menu_options = document.getElementById('left-panel');
  menu_options.style.marginLeft = '0px';
  menu_options.style.boxShadow = '2px 0px 10px 2px #8e8e8e';
}

export function options_menu_hide() {
  const menu_options = document.getElementById('left-panel');
  menu_options.style.marginLeft = '-320px';
  menu_options.style.boxShadow = '';  // HACK
}

export function options_menu_onclick(event) {
  const option = event.target;
  if (option.localName !== 'li') {
    return;
  }

  switch (option.id) {
    case 'menu-option-subscribe':
      log('Not yet implemented');
      break;
    case 'menu-option-import':
      import_menu_option_onclick(event);
      break;
    case 'menu-option-export':
      export_menu_option_handle_click(event);
      break;
    case 'menu-option-header-font':
      break;
    case 'menu-option-body-font':
      break;
    default:
      log('Unhandled menu option click', option.id);
      break;
  }
}
