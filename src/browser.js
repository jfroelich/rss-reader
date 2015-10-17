// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

lucu.browser = {};

lucu.browser.queryIdleState = function(interval, callback) {
  'use strict';

  chrome.permissions.contains({permissions: ['idle']}, onCheck);

  function onCheck(permitted) {
  	if(!permitted) {
  	  callback();
  	  return;
  	}

  	chrome.idle.queryState(interval, callback);
  }
};

lucu.browser.updateBadge = function() {
  'use strict';
  lucu.database.connect(onConnect, console.error);

  function onConnect(error, database) {
    const transaction = database.transaction('entry');
    const entries = transaction.objectStore('entry');
    const unread = entries.index('unread');
    const request = unread.count();
    request.onsuccess = setText;
  }

  function setText(event) {
    const count = event.target.result || 0;
    const badgeText = {text: count.toString()};
    chrome.browserAction.setBadgeText(badgeText);
  }
};

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
lucu.browser.onBadgeClick = function(event) {
  'use strict';
  // console.debug('Clicked badge');
  const VIEW_URL = chrome.extension.getURL('slides.html');
  // TODO: is the trailing slash necessary?
  const NEW_TAB_URL = 'chrome://newtab/';
  chrome.tabs.query({'url': VIEW_URL}, onQueryView);

  function onQueryView(tabs) {
    if(tabs.length) {
      chrome.tabs.update(tabs[0].id, {active: true});
      return;
    }

    chrome.tabs.query({url: NEW_TAB_URL}, onQueryNewTab);
  }

  function onQueryNewTab(tabs) {
    if(tabs.length) {
      chrome.tabs.update(tabs[0].id, {active:true, url: VIEW_URL});
      return;
    }

    chrome.tabs.create({url: VIEW_URL});
  }
};

lucu.browser.isOffline = function() {
  'use strict';
  return navigator && navigator.hasOwnProperty('onLine') && 
  	!navigator.onLine;
};
