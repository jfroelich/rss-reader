import {resolve_extension_path} from '/src/resolve-extension-path.js';
import * as tls from '/src/typed-localstorage.js';

// Open the slideshow view in a tab.
export async function open_view() {
  // Check if the view is already open and switch to it
  const url_string = resolve_extension_path('slideshow.html');
  const view_tab = await find_tab(url_string);
  if (view_tab) {
    update_tab(view_tab.id, {active: true});
    return;
  }

  // Otherwise, try and reuse the newtab tab
  const reuse_newtab = tls.read_boolean('reuse_newtab');
  if (reuse_newtab) {
    const newtab = await find_tab('chrome://newtab/');
    if (newtab) {
      update_tab(newtab.id, {active: true, url: url_string});
      return;
    }
  }

  // Otherwise, open the view in a new tab
  create_tab({active: true, url: url_string});
}

export function update_tab(id, options) {
  return chrome.tabs.update(id, options);
}

export function create_tab(options) {
  return chrome.tabs.create(options);
}

export function find_tab(url_string) {
  return new Promise(resolve => {
    chrome.tabs.query({url: url_string}, tabs => {
      resolve((tabs && tabs.length) ? tabs[0] : undefined);
    });
  });
}
