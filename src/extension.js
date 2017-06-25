'use strict';

// TODO: resolve bugs with binding listeners in both background and view
// Certain listeners should only be bound once, to only the background page

// Updates the number that appears on the icon in Chrome's toolbar
// TODO: change all callers to pass in conn instead of deprecated entryStore
async function updateBadgeText(conn) {
  const count = await db.countUnreadEntries(conn);
  const text = count > 999 ? '1k+' : '' + count;
  chrome.browserAction.setBadgeText({'text': text});
}

// The response to clicking on the button in Chrome's toolbar
async function badgeOnClick(event) {
  try {
    await showSlideshowTab();
  } catch(error) {
    console.error(error);
  }
}

async function showSlideshowTab() {

  // First try switching back to the extension's tab if open
  const viewURLString = chrome.extension.getURL('slideshow.html');
  let tabArray = await findTabsByURL(viewURLString);
  if(tabArray && tabArray.length) {
    chrome.tabs.update(tabArray[0].id, {'active': true});
    return;
  }

  // Next try replacing the new tab if open. If multiple new tab tabs are open
  // then the first is used.
  const newtabURLString = 'chrome://newtab/';
  tabArray = await findTabsByURL(newtabURLString);
  if(tabArray && tabArray.length) {
    chrome.tabs.update(tabArray[0].id, {'active': true, 'url': viewURLString});
    return;
  }

  // Otherwise open a new tab
  chrome.tabs.create({'url': viewURLString});
}

// Resolves with an array of tabs. Requires 'tabs' permission
// @param url {String} the url of the tab searched for
function findTabsByURL(url) {
  return new Promise((resolve) => chrome.tabs.query({'url': url}, resolve));
}

async function extensionOnInstalled(event) {
  console.log('Received install event');

  // Create or upgrade the database by connecting to it

  let conn;
  try {
    conn = await db.connect();

    // Initialize the app badge
    await updateBadgeText(conn);
  } catch(error) {
    console.debug(error);
  } finally {
    if(conn)
      conn.close();
  }
};

// TODO: rather than bind every page load, only bind once

// Shows a simple desktop notification with the given title and message.
// Message and title are interpreted as plain text.
// To show in notification center on mac, toggle flag
// chrome://flags/#enable-native-notifications
function showNotification(titleString, messageString, iconURLString) {
  if(typeof Notification === 'undefined') {
    console.warn('Notification API not supported');
    return;
  }

  if(!('SHOW_NOTIFICATIONS' in localStorage)) {
    console.warn('Notifications disabled in settings', titleString);
    return;
  }

  if(Notification.permission !== 'granted') {
    console.warn('Notification permission not granted', titleString);
  }

  const defaultIconURLString =
    chrome.extension.getURL('/images/rss_icon_trans.gif');

  const detailsObject = {};
  detailsObject.body = messageString || '';
  detailsObject.icon = iconURLString || defaultIconURLString;

  // Instantiation also shows
  const notification = new Notification(titleString, detailsObject);

  // Attach a click listener that opens the extension
  // Note: on Mac Chrome 55, double click triggers click event
  notification.addEventListener('click', notificationOnClick);
}

async function notificationOnClick(event) {
  // Ensure the browser is open to avoid mac chrome crash in 55
  try {
    const winObject = window.open();
    winObject.close();
  } catch(error) {
    console.warn(error);
  }

  try {
    await showSlideshowTab();
  } catch(error) {
    console.error(error);
  }
}
