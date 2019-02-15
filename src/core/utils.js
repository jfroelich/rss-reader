import {assert} from '/src/lib/assert.js';

// Maybe generate and show a desktop notification provided that notifications
// are enabled in settings. |note| has optional properties name, message, and
// url (string). Defaults are provided for missing properties.
// TODO: utils is located in core, so this is located in core, so there is no
// longer a need to do config dependency injection, so the config parameter
// should be removed and instead config should be imported
export function show_notification(config, note) {
  if (!config.read_boolean('show_notifications')) {
    return;
  }

  const title = note.title || 'Untitled';
  const message = note.message || '';

  const details = {};
  details.body = message || '';

  const default_icon = chrome.extension.getURL('/images/rss_icon_trans.gif');
  details.icon = note.url || default_icon;

  const notification = new Notification(title, details);
  notification.addEventListener('click', event => {
    try {
      const hwnd = window.open();
      hwnd.close();
    } catch (error) {
      console.error(error);
      return;
    }
    open_view(config).catch(console.warn);
  });
}

// Open the slideshow view in a tab.
// @param config {Module} a reference to a config module object
export async function open_view(config) {
  // Check if the view is open and switch to it
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

  // Otherwise, open the view in a new tab
  chrome.tabs.create({active: true, url: url_string});
}

// Searches for an open tab with the given url
function find_tab(url_string) {
  return new Promise(resolve => {
    const query = {url: url_string};
    chrome.tabs.query(query, tabs => {
      if (tabs && tabs.length) {
        resolve(tabs[0]);
      }
      resolve();
    });
  });
}
