// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

const VIEW_URL = chrome.extension.getURL('slides.html');

// TODO: is there a way to not do this on every page load?
chrome.browserAction.onClicked.addListener(function(event) {
  chrome.tabs.query({'url': VIEW_URL}, on_query_for_view_tab);
});

function on_query_for_view_tab(tabs) {
  if(tabs && tabs.length) {
    chrome.tabs.update(tabs[0].id, {'active': true});
  } else {
    // trailing slash is required
    chrome.tabs.query({'url': 'chrome://newtab/'},
      on_query_for_new_tab);
  }
}

function on_query_for_new_tab(tabs) {
  if(tabs && tabs.length) {
    chrome.tabs.update(tabs[0].id, {'active': true, 'url': VIEW_URL});
  } else {
    chrome.tabs.create({'url': VIEW_URL});
  }
}

} // End file block scope
