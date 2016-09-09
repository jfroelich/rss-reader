// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

const VIEW_URL = chrome.extension.getURL('slides.html');

// The trailing slash is required
const NEW_TAB_URL = 'chrome://newtab/'

// TODO: is there a way to not do this on every page load?
chrome.browserAction.onClicked.addListener(function(event) {
  chrome.tabs.query({'url': VIEW_URL}, onQueryForViewTab);
});

function onQueryForViewTab(tabs) {
  if(tabs && tabs.length) {
    chrome.tabs.update(tabs[0].id, {'active': true});
  } else {
    chrome.tabs.query({'url': NEW_TAB_URL}, onQueryForNewTab);
  }
}

function onQueryForNewTab(tabs) {
  if(tabs && tabs.length) {
    chrome.tabs.update(tabs[0].id, {'active': true, 'url': VIEW_URL});
  } else {
    chrome.tabs.create({'url': VIEW_URL});
  }
}

} // End file block scope
