// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Utility functions for chrome.browserAction
class BrowserActionUtils {

  // TODO: whether to reuse the newtab page should possibly be a setting that
  // is disabled by default, so this should be checking if that setting is
  // enabled before querying for the new tab.
  // NOTE: the calls to chrome.tabs here do not require the tabs permission
  // TODO: is the trailing slash necessary for new tab?
  static onClicked(event) {
  	const viewURL = chrome.extension.getURL('slides.html');
    const newTabURL = 'chrome://newtab/';
    chrome.tabs.query({'url': viewURL}, function(tabs) {
      if(tabs.length) {
        chrome.tabs.update(tabs[0].id, {active: true});
      } else {
        chrome.tabs.query({url: newTabURL}, onQueryNewTab);
      }
    });

    function onQueryNewTab(tabs) {
      if(tabs.length) {
        chrome.tabs.update(tabs[0].id, {active: true, url: viewURL});
      } else {
        chrome.tabs.create({url: viewURL});
      }
    }
  }

  static update(connection) {
    // console.debug('Updating badge');
    if(connection) {
      EntryStore.countUnread(connection, BrowserActionUtils._setText);
    } else {
      Database.open(function(event) {
        if(event.type === 'success') {
          EntryStore.countUnread(event.target.result, 
            BrowserActionUtils._setText);
        } else {
          console.debug(event);
          chrome.browserAction.setBadgeText({text: '?'});
        }
      });
    }
  }

  static _setText(event) {
    const count = event.target.result;
    chrome.browserAction.setBadgeText({
      text: count.toString()
    });
  }
}
