'use strict';

// import rbl.js
// import reader-db.js

function openTab(url) {
  chrome.tabs.create({active: true, url: url});
}

function queryIdleState(idlePeriodSecs) {
  return new Promise(function executor(resolve, reject) {
    chrome.idle.queryState(idlePeriodSecs, resolve);
  });
}

function setBadgeText(text) {
  chrome.browserAction.setBadgeText({'text': text});
}

async function showSlideshowTab() {
  const slideshowURL = chrome.extension.getURL('slideshow.html');
  const newtabURL = 'chrome://newtab/';

  let tabs = await findTabsByURL(slideshowURL);
  if(tabs && tabs.length) {
    chrome.tabs.update(tabs[0].id, {active: true});
    return;
  }

  tabs = await findTabsByURL(newtabURL);
  if(tabs && tabs.length) {
    chrome.tabs.update(tabs[0].id,
      {active: true, url: slideshowURL});
    return;
  }

  chrome.tabs.create({url: slideshowURL});
}

function findTabsByURL(urlString) {
  return new Promise(function executor(resolve, reject) {
    return chrome.tabs.query({url: urlString}, resolve);
  });
}

function showNotification(title, message, iconURL) {
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
  notification.addEventListener('click', browserNotificationOnClick);
}

async function browserNotificationOnClick(event) {
  try {
    // Ensure the browser is open to avoid mac chrome crash in 55
    // TODO: test if this behavior is still present in latest chrome and if
    // not then remove
    const windowHandle = window.open();
    windowHandle.close();
    await showSlideshowTab();
  } catch(error) {
    console.warn(error);
  }
}

function hasBrowserPermission(permission) {
  return new Promise(function executor(resolve, reject) {
    const descriptor = {permissions: [permission]};
    chrome.permissions.contains(descriptor, resolve);
  });
}

function requestBrowserPermission(permission) {
  return new Promise(function executor(resolve, reject) {
    const descriptor = {permissions: [permission]};
    chrome.permissions.request(descriptor, resolve);
  });
}

function removeBrowserPermission(permission) {
  return new Promise(function executor(resolve, reject) {
    const descriptor = {permissions: [permission]};
    chrome.permissions.remove(descriptor, resolve);
  });
}
