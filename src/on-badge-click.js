// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Respond to a click on the extension's icon in Chrome's extension toolbar
// NOTE: in order to use the url property with chrome.tabs.query, the tabs
// permission is required, this is the sole reason it is defined within
// manifest.json. Previously this was not the case, but it looks like Chrome
// silently changed the requirements without much of a notice, which is
// why this had stopped working until I re-added the tabs permission.
function onBadgeClick() {
  const VIEW_URL = chrome.extension.getURL('slides.html');
  chrome.tabs.query({'url': VIEW_URL}, onQueryForViewTab);

  function onQueryForViewTab(tabsArray) {
    if(tabsArray && tabsArray.length) {
      chrome.tabs.update(tabsArray[0].id, {'active': true});
    } else {
      // NOTE: the trailing slash is required
      chrome.tabs.query({'url': 'chrome://newtab/'}, onQueryForNewTab);
    }
  }

  function onQueryForNewTab(tabsArray) {
    if(tabsArray && tabsArray.length) {
      chrome.tabs.update(tabsArray[0].id, {'active': true, 'url': VIEW_URL});
    } else {
      chrome.tabs.create({'url': VIEW_URL});
    }
  }
}

chrome.browserAction.onClicked.addListener(onBadgeClick);
