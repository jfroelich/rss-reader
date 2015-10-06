// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

lucu.badge = {};

// Sets the badge text to a count of unread entries
lucu.badge.update = function() {
  'use strict';
  // console.debug('Updating badge');
  lucu.database.connect(lucu.badge.onConnect, console.error);
};

lucu.badge.onConnect = function(error, database) {
  'use strict';
  var transaction = database.transaction('entry');
  var entryStore = transaction.objectStore('entry');
  var unreadIndex = entryStore.index('unread');
  var countRequest = unreadIndex.count();
  countRequest.onsuccess = lucu.badge.setText;
};

lucu.badge.setText = function(event) {
  'use strict';
  var count = event.target.result || 0;
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
  'use strict';
  // console.debug('Clicked badge');
  var query = {'url': lucu.badge.VIEW_URL};
  chrome.tabs.query(query, lucu.badge.onQueryView);
};

// onBadgeClick helper
lucu.badge.onQueryView = function(tabs) {
  'use strict';
  if(tabs.length) {
    // console.debug('Switching to existing tab');
    // Switch to an existing tab
    chrome.tabs.update(tabs[0].id, {active: true});
    return;
  }

  var query = {url: lucu.badge.NEW_TAB_URL};
  chrome.tabs.query(query, lucu.badge.onQueryNewTab);
};

// onBadgeClick helper
lucu.badge.onQueryNewTab = function(tabs) {
  'use strict';
  if(tabs.length) {
    // console.debug('Replacing New Tab');
    // Switch to and replace the New Tab tab
    chrome.tabs.update(tabs[0].id, 
      {active:true, url: lucu.badge.VIEW_URL});
    return;
  }

  // console.debug('Opening a new tab');
  // Create and switch to a new tab
  chrome.tabs.create({url: lucu.badge.VIEW_URL});
};
