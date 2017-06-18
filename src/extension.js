'use strict';

// TODO: resolve bugs with binding listeners in both background and view
// Certain listeners should only be bound once, to only the background page

// Updates the number that appears on the icon in Chrome's toolbar
// TODO: change all callers to pass in conn instead of deprecated entryStore
async function jrExtensionUpdateBadge(conn) {
  const count = await dbCountUnreadEntries(conn);
  const text = count > 999 ? '1k+' : '' + count;
  chrome.browserAction.setBadgeText({'text': text});
}

// The response to clicking on the button in Chrome's toolbar
async function jrExtensionBadgeOnClick(event) {
  try {
    await jrExtensionShowSlideshow();
  } catch(error) {
    console.error(error);
  }
}

chrome.browserAction.onClicked.addListener(jrExtensionBadgeOnClick);


async function jrExtensionShowSlideshow() {

  // First try switching back to the extension's tab if open
  const viewURLString = chrome.extension.getURL('slideshow.html');
  let tabArray = await jrExtensionFindTabsByURL(viewURLString);
  if(tabArray && tabArray.length) {
    chrome.tabs.update(tabArray[0].id, {'active': true});
    return;
  }

  // Next try replacing the new tab if open. If multiple new tab tabs are open
  // then the first is used.
  const newtabURLString = 'chrome://newtab/';
  tabArray = await jrExtensionFindTabsByURL(newtabURLString);
  if(tabArray && tabArray.length) {
    chrome.tabs.update(tabArray[0].id, {'active': true, 'url': viewURLString});
    return;
  }

  // Otherwise open a new tab
  chrome.tabs.create({'url': viewURLString});
}

// Resolves with an array of tabs. Requires 'tabs' permission
// @param url {String} the url of the tab searched for
function jrExtensionFindTabsByURL(url) {
  return new Promise((resolve) => chrome.tabs.query({'url': url}, resolve));
}

async function jrExtensionOnInstalled(event) {
  console.log('Received install event');

  // Create or upgrade the database by connecting to it
  const db = new ReaderDb();
  let conn;
  try {
    conn = await db.dbConnect();

    // Initialize the app badge
    const entryStore = new EntryStore(conn);
    await jrExtensionUpdateBadge(entryStore);
  } catch(error) {
    console.debug(error);
  } finally {
    if(conn)
      conn.close();
  }
};

// TODO: rather than bind every page load, only bind once
chrome.runtime.onInstalled.addListener(jrExtensionOnInstalled);

// Shows a simple desktop notification with the given title and message.
// Message and title are interpreted as plain text.
// To show in notification center on mac, toggle flag
// chrome://flags/#enable-native-notifications
function jrExtensionShowNotification(title, message, iconURLString) {
  if(typeof Notification === 'undefined') {
    console.warn('Notification API not supported');
    return;
  }

  if(!('SHOW_NOTIFICATIONS' in localStorage)) {
    console.warn('Notifications disabled in settings', title);
    return;
  }

  if(Notification.permission !== 'granted') {
    console.warn('Notification permission not granted', title);
  }

  const defaultIconURLString = chrome.extension.getURL(
    '/images/rss_icon_trans.gif');
  const details = {};
  details.body = message || '';
  details.icon = iconURLString || defaultIconURLString;

  // Instantiation also shows
  const notification = new Notification(title, details);

  // Attach a click listener that opens the extension
  // Note: on Mac Chrome 55, double click triggers click event
  notification.addEventListener('click', jrExtensionNotificationOnClick);
}

async function jrExtensionNotificationOnClick(event) {
  // Ensure the browser is open to avoid mac chrome crash in 55
  try {
    const winObject = window.open();
    winObject.close();
  } catch(error) {
    console.warn(error);
  }

  try {
    await jrExtensionShowSlideshow();
  } catch(error) {
    console.error(error);
  }
}
