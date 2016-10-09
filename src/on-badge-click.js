// See license.md

'use strict';

{ // Begin file block scope

const viewURL = chrome.extension.getURL('slideshow.html');

const newTabURL = 'chrome://newtab/';

// TODO: is there a way to not do this on every page load?
chrome.browserAction.onClicked.addListener(function(event) {
  chrome.tabs.query({'url': viewURL}, onQueryForViewTab);
});

function onQueryForViewTab(tabs) {
  if(tabs && tabs.length) {
    chrome.tabs.update(tabs[0].id, {'active': true});
  } else {
    chrome.tabs.query({'url': newTabURL}, onQueryForNewTab);
  }
}

function onQueryForNewTab(tabs) {
  if(tabs && tabs.length) {
    chrome.tabs.update(tabs[0].id, {'active': true, 'url': viewURL});
  } else {
    chrome.tabs.create({'url': viewURL});
  }
}

} // End file block scope
