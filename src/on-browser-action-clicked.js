// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // BEGIN FILE SCOPE

// TODO: whether to reuse the newtab page should possibly be a setting that
// is disabled by default, so this should be checking if that setting is
// enabled before querying for the new tab.
// NOTE: the calls to chrome.tabs here do not require the tabs permission
// NOTE: because this file does the binding, it should only be included once
// in the background page of the extension, otherwise the multiple listeners are
// registered and funky things happen.

const viewURL = chrome.extension.getURL('slides.html');

// React to user clicking on the toolbar button. If the extension is already
// open, switch to it. Otherwise, if the new tab page is present, replace
// it. Otherwise, open a new tab and switch to it.
function onBrowserActionClicked(event) {
  chrome.tabs.query({'url': viewURL}, onQueryView);
}

function onQueryView(tabs) {
  // TODO: is the trailing slash necessary for new tab?
  const newTabURL = 'chrome://newtab/';

  if(tabs.length) {
    chrome.tabs.update(tabs[0].id, {active: true});
  } else {
    chrome.tabs.query({url: newTabURL}, onQueryNewTab);
  }
}

function onQueryNewTab(tabs) {
  if(tabs.length) {
    chrome.tabs.update(tabs[0].id, {active: true, url: viewURL});
  } else {
    chrome.tabs.create({url: viewURL});
  }
}

chrome.browserAction.onClicked.addListener(onBrowserActionClicked);

} // END FILE SCOPE
