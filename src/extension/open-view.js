import * as config from '/src/config.js';

// Open the slideshow view in a tab.
export default async function open_view() {
  // Check if the view is already open and switch to it
  const url_string = chrome.extension.getURL('slideshow.html');
  const view_tab = await find_tab(url_string);
  if (view_tab) {
    chrome.tabs.update(view_tab.id, {active: true});
    return;
  }

  // Otherwise, try and reuse the newtab tab
  const reuse_newtab = config.read_boolean('reuse_newtab');
  if (reuse_newtab) {
    const newtab = await find_tab('chrome://newtab/');
    if (newtab) {
      chrome.tabs.update(newtab.id, {active: true, url: url_string});
      return;
    }
  }

  // Otherwise, open the view in a new tab. Note that not using tab create is
  // to try and make less platform specific.
  open(url_string, '_blank');
}

function find_tab(url_string) {
  return new Promise(resolve => {
    chrome.tabs.query({url: url_string}, tabs => {
      resolve((tabs && tabs.length) ? tabs[0] : undefined);
    });
  });
}
