// Browser action lib
(function(exports, model) {
'use strict';

// Updates the badge text to the current unread count
function updateBadge() {
  // console.log('Updating badge');
  model.connect(onUpdateBadgeConnect);
}

function onUpdateBadgeConnect(db) {
  model.countUnread(db, setBadgeText);
}

function setBadgeText(count) {
  var count = parseInt(count) || 0;
  chrome.browserAction.setBadgeText({'text': count.toString()});
}

// Constants used by tab management
var viewURL = chrome.extension.getURL('view.html');
var newTabURL = 'chrome://newtab/';
var viewTabQuery = {'url': viewURL};

// Opens the view either in a new tab, by activating an inactive tab
// or by replacing the first new tab
function openExtensionView(tab) {
  chrome.tabs.query(viewTabQuery, activateOrCheckNewTab);
}

// Either updates the extisting view or searches for the newtab tab
function activateOrCheckNewTab(tabs) {
  if(tabs.length) {
    chrome.tabs.update(tabs[0].id, {'active':true});
  } else {
    chrome.tabs.query({'url': newTabURL}, createOrUpdateTab);
  }
}

// Replaces the existing newtab with the view, or creates a new tab
function createOrUpdateTab(tabs){
  if(tabs.length) {
    chrome.tabs.update(tabs[0].id, {'active':true,'url': viewURL});
  } else {
    chrome.tabs.create({'url': viewURL});
  }
}

// Exports
exports.updateBadge = updateBadge;

// Bindings
chrome.runtime.onInstalled.addListener(setBadgeText);
chrome.runtime.onStartup.addListener(updateBadge);
chrome.browserAction.onClicked.addListener(openExtensionView);

})(this, model);