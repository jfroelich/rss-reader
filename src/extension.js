'use strict';

// import reader-db.js

function extension_idle_query(idle_period_secs) {
  return new Promise(function executor(resolve, reject) {
    chrome.idle.queryState(idle_period_secs, resolve);
  });
}

function extension_set_badge_text(count) {
  count = count || 0;
  const text = count > 999 ? '1k+' : '' + count;
  chrome.browserAction.setBadgeText({'text': text});
}

async function extension_show_slideshow_tab() {
  const slideshow_url_string = chrome.extension.getURL('slideshow.html');
  const newtab_url_string = 'chrome://newtab/';

  let tabs = await extension_find_tabs_by_url(slideshow_url_string);
  if(tabs && tabs.length) {
    chrome.tabs.update(tabs[0].id, {'active': true});
    return;
  }

  tabs = await extension_find_tabs_by_url(newtab_url_string);
  if(tabs && tabs.length) {
    chrome.tabs.update(tabs[0].id,
      {'active': true, 'url': slideshow_url_string});
    return;
  }

  chrome.tabs.create({'url': slideshow_url_string});
}

function extension_find_tabs_by_url(url_string) {
  return new Promise(function executor(resolve, reject) {
    return chrome.tabs.query({'url': url_string}, resolve);
  });
}

function extension_notify(title, message, icon_url_string) {
  if(typeof Notification === 'undefined') {
    return;
  }

  if(!('SHOW_NOTIFICATIONS' in localStorage)) {
    return;
  }

  if(Notification.permission !== 'granted') {
    return;
  }

  const default_icon_url_string =
    chrome.extension.getURL('/images/rss_icon_trans.gif');

  const details = {};
  details.body = message || '';
  details.icon = icon_url_string || default_icon_url_string;

  // Instantiation also shows
  const notification = new Notification(title, details);
  notification.addEventListener('click', extension_notification_on_click);
}

async function extension_notification_on_click(event) {
  try {
    // Ensure the browser is open to avoid mac chrome crash in 55
    // TODO: test if this behavior is still present in latest chrome and if
    // not then remove
    const window_handle = window.open();
    window_handle.close();
    await extension_show_slideshow_tab();
  } catch(error) {
    console.warn(error);
  }
}

function extension_permissions_contains(permission) {
  console.assert(typeof permission === 'string');
  return new Promise(function executor(resolve, reject) {
    const descriptor = {'permissions': [permission]};
    chrome.permissions.contains(descriptor, resolve);
  });
}

function extension_permissions_request(permission) {
  console.assert(typeof permission === 'string');
  return new Promise(function executor(resolve, reject) {
    const descriptor = {'permissions': [permission]};
    chrome.permissions.request(descriptor, resolve);
  });
}

function extension_permissions_remove(permission) {
  console.assert(typeof permission === 'string');
  return new Promise(function executor(resolve, reject) {
    const descriptor = {'permissions': [permission]};
    chrome.permissions.remove(descriptor, resolve);
  });
}
