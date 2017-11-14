// extension utilities module that provides an abstraction around platform specific functionality

// TODO: rename to platform-chrome.js or something similar, and then change the nature of this
// module to serve only as a proxy for interacting with Chrome

export function addInstallListener(listener) {
  console.debug('binding install listener');
  chrome.runtime.onInstalled.addListener(listener);
}

export function addBadgeClickListener(listener) {
  chrome.browserAction.onClicked.addListener(listener);
}

export function openTab(url) {
  chrome.tabs.create({active: true, url: url});
}

export function queryIdleState(idlePeriodSecs) {
  return new Promise(function executor(resolve, reject) {
    chrome.idle.queryState(idlePeriodSecs, resolve);
  });
}

export function setBadgeText(text) {
  chrome.browserAction.setBadgeText({'text': text});
}

export async function showSlideshowTab() {
  const slideshowURL = chrome.extension.getURL('slideshow.html');
  const newtabURL = 'chrome://newtab/';

  let tabs = await findTabsByURL(slideshowURL);
  if(tabs && tabs.length) {
    chrome.tabs.update(tabs[0].id, {active: true});
    return;
  }

  tabs = await findTabsByURL(newtabURL);
  if(tabs && tabs.length) {
    chrome.tabs.update(tabs[0].id, {active: true, url: slideshowURL});
    return;
  }

  chrome.tabs.create({url: slideshowURL});
}

function findTabsByURL(urlString) {
  return new Promise(function executor(resolve, reject) {
    return chrome.tabs.query({url: urlString}, resolve);
  });
}

export function showNotification(title, message, iconURL) {
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
  notification.addEventListener('click', notificationOnClick);
}

async function notificationOnClick(event) {
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

export function hasBrowserPermission(permission) {
  return new Promise(function executor(resolve, reject) {
    const descriptor = {permissions: [permission]};
    chrome.permissions.contains(descriptor, resolve);
  });
}

export function requestBrowserPermission(permission) {
  return new Promise(function executor(resolve, reject) {
    const descriptor = {permissions: [permission]};
    chrome.permissions.request(descriptor, resolve);
  });
}

export function removeBrowserPermission(permission) {
  return new Promise(function executor(resolve, reject) {
    const descriptor = {permissions: [permission]};
    chrome.permissions.remove(descriptor, resolve);
  });
}
