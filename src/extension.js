'use strict';

// import base/assert.js
// import reader-db.js

function extensionIdleQuery(idlePeriodSecs) {
  return new Promise(function executor(resolve, reject) {
    chrome.idle.queryState(idlePeriodSecs, resolve);
  });
}

function extensionSetBadgeText(count) {
  count = count || 0;
  const text = count > 999 ? '1k+' : '' + count;
  console.debug('setting badge text to', text);
  chrome.browserAction.setBadgeText({'text': text});
}

async function extensionShowSlideshowTab() {
  const slideshowURL = chrome.extension.getURL('slideshow.html');
  const newtabURL = 'chrome://newtab/';

  let tabs = await extensionFindTabsByURL(slideshowURL);
  if(tabs && tabs.length) {
    chrome.tabs.update(tabs[0].id, {active: true});
    return;
  }

  tabs = await extensionFindTabsByURL(newtabURL);
  if(tabs && tabs.length) {
    chrome.tabs.update(tabs[0].id,
      {active: true, url: slideshowURL});
    return;
  }

  chrome.tabs.create({url: slideshowURL});
}

function extensionFindTabsByURL(urlString) {
  return new Promise(function executor(resolve, reject) {
    return chrome.tabs.query({url: urlString}, resolve);
  });
}

function extensionNotify(title, message, iconURL) {
  if(typeof Notification === 'undefined') {
    return;
  }

  if(!('SHOW_NOTIFICATIONS' in localStorage)) {
    return;
  }

  if(Notification.permission !== 'granted') {
    return;
  }

  const defaultIconURL = chrome.extension.getURL('/images/rss_icon_trans.gif');

  const details = {};
  details.body = message || '';
  details.icon = iconURL || defaultIconURL;

  // Instantiation also shows
  const notification = new Notification(title, details);
  notification.addEventListener('click', extensionNotificationOnclick);
}

async function extensionNotificationOnclick(event) {
  try {
    // Ensure the browser is open to avoid mac chrome crash in 55
    // TODO: test if this behavior is still present in latest chrome and if
    // not then remove
    const windowHandle = window.open();
    windowHandle.close();
    await extensionShowSlideshowTab();
  } catch(error) {
    console.warn(error);
  }
}

function extensionPermissionsContains(permission) {
  assert(typeof permission === 'string');
  return new Promise(function executor(resolve, reject) {
    const descriptor = {permissions: [permission]};
    chrome.permissions.contains(descriptor, resolve);
  });
}

function extensionPermissionsRequest(permission) {
  assert(typeof permission === 'string');
  return new Promise(function executor(resolve, reject) {
    const descriptor = {permissions: [permission]};
    chrome.permissions.request(descriptor, resolve);
  });
}

function extensionPermissionsRemove(permission) {
  assert(typeof permission === 'string');
  return new Promise(function executor(resolve, reject) {
    const descriptor = {permissions: [permission]};
    chrome.permissions.remove(descriptor, resolve);
  });
}
