// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

lucu.badge = {};

// Sets the badge text to a count of unread entries
lucu.badge.update = function() {
  // console.debug('Updating badge');
  var request = indexedDB.open(lucu.db.NAME, lucu.db.VERSION);
  request.onerror = console.error;
  request.onblocked = console.error;

  // Extra bind here since this is temporarily also used to 
  // trigger database creation on install
  // TODO: remove this once we clean up the install code
  request.onupgradeneeded = lucu.db.upgrade;

  request.onsuccess = lucu.badge.onConnect;
};

lucu.badge.onConnect = function(event) {
  var db = event.target.result;
  var tx = db.transaction('entry');
  var store = tx.objectStore('entry');
  var index = store.index('unread');
  var countRequest = index.count();
  countRequest.onsuccess = lucu.badge.setText;
};

lucu.badge.setText = function(event) {
  var count = event.target.result || 0;

  // NOTE: Chrome supports at least 4 digits in badge text,
  // not sure what happens after 9999
  var badgeText = {text: count.toString()};

  chrome.browserAction.setBadgeText(badgeText);
};

lucu.badge.VIEW_URL = chrome.extension.getURL('slides.html');

// TODO: is the trailing slash necessary?
lucu.badge.NEW_TAB_URL = 'chrome://newtab/';

/**
 * Called when the extension's icon button is clicked in browser's toolbar.
 * This tries to not open the extension additional times,
 * but this is not fullproof because the user can open a new tab and copy
 * and paste the url (no defensive code exists for that at the moment).
 * TODO: whether to reuse the newtab page should possibly be a setting that
 * is disabled by default, so this should be checking if that setting is
 * enabled before querying for the new tab.
 * NOTE: the calls to chrome.tabs here do not require the tabs permission
 */
lucu.badge.onClick = function(event) {
  var query = {'url': lucu.badge.VIEW_URL};
  chrome.tabs.query(query, lucu.badge.onQueryView);
};

// Binds on background page load
// TODO: bind once on install?
chrome.browserAction.onClicked.addListener(lucu.badge.onClick);

// onBadgeClick helper
lucu.badge.onQueryView = function(tabs) {
  if(tabs.length) {
    // Switch to an existing tab
    chrome.tabs.update(tabs[0].id, {active: true});
    return;
  }

  var query = {url: lucu.badge.NEW_TAB_URL};
  chrome.tabs.query(query, lucu.badge.onQueryNewTab);
};

// onBadgeClick helper
lucu.badge.onQueryNewTab = function(tabs) {
  if(tabs.length) {
    // Switch to and replace the New Tab tab
    chrome.tabs.update(tabs[0].id, 
      {active:true, url: lucu.badge.VIEW_URL});
    return;
  }

  // Create and switch to a new tab
  chrome.tabs.create({url: lucu.badge.VIEW_URL});
};
