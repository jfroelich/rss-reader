// TODO: break up this module, it should not exist, it doesn't really fit

import * as ls from '/src/ls/ls.js';

export async function open_view() {
  const url_string = chrome.extension.getURL('slideshow.html');

  let tab = await find_tab(url_string);
  if (tab) {
    chrome.tabs.update(tab.id, {active: true});
    return;
  }

  const reuse_newtab = ls.read_boolean('reuse_newtab');
  if (reuse_newtab) {
    tab = await find_tab('chrome://newtab/');
    if (tab) {
      chrome.tabs.update(tab.id, {active: true, url: url_string});
      return;
    }
  }

  chrome.tabs.create({active: true, url: url_string});
}

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

export function show_notification(title, message, icon_url_string) {
  if (!ls.read_boolean('show_notifications')) {
    return;
  }

  if (Notification.permission !== 'granted') {
    return;
  }

  const details = {};
  details.body = message || '';

  const default_icon = chrome.extension.getURL('/images/rss_icon_trans.gif');
  details.icon = icon_url_string || default_icon;

  const notification = new Notification(title, details);
  notification.addEventListener('click', notification_onclick);
}

// TODO: test if this is still needed to workaround Chrome 66 error when
// window is closed
async function notification_onclick(event) {
  try {
    const hwnd = window.open();
    hwnd.close();
  } catch (error) {
    console.error(error);
    return;
  }

  await open_view();
}
