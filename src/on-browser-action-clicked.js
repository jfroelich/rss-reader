// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

function browserActionOnClick() {
  'use strict';

  const viewURL = chrome.extension.getURL('slides.html');

  chrome.tabs.create({url: viewURL});

  // TODO: the above works. Something went wrong upgrading from chrome 48...
  // to 49.... The query finds the existing tab and updates it, but it is
  // never displayed. It finds it even where there is no visible matching
  // tab. Also, the first time I clicked it, Chrome crashed. Review the
  // chrome tabs API.
  // TODO: looking at release notes for 50, I am seeing that they are
  // mucking with tab management 
  //chrome.tabs.query({'url': viewURL}, onQueryView);

  function onQueryView(tabs) {
    // TODO: is the trailing slash necessary?
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
}

chrome.browserAction.onClicked.addListener(browserActionOnClick);
