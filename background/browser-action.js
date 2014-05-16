// Browser action lib
(function(global, model) {
'use strict';

// Updates the badge text to the current unread count
function updateBadge() {
  model.connect(onUpdateBadgeConnect);
}

function onUpdateBadgeConnect(db) {
  model.countUnread(db, onCountUnread);
}

function onCountUnread(count) {
  chrome.browserAction.setBadgeText({'text': count.toString()});
}

// Either updates the extisting view or searches for the newtab tab
function handleViewQuery(tabs) {
  if(tabs.length) {
    // Found existing view, select it
    chrome.tabs.update(tabs[0].id, {'active':true});
  } else {
    // Check for new tabs and either replace or create
    chrome.tabs.query({'url': 'chrome://newtab/'}, handleTabQuery);
  }
}

// Replaces the existing newtab with the view, or creates a new tab
function handleTabQuery(newTabs){
  var viewURL = chrome.extension.getURL('view.html');
  if(newTabs.length) {
    // Found the first new tab, replace it with view
    chrome.tabs.update(newTabs[0].id, {'active':true,'url': viewURL});
  } else {
    // Didn't find any new tabs, create one
    chrome.tabs.create({'url': viewURL});
  }
}

// Export globals
global.updateBadge = updateBadge;

// Bindings
chrome.runtime.onInstalled.addListener(function() {
    chrome.browserAction.setBadgeText({'text':"0"});
});

chrome.runtime.onStartup.addListener(function() {
  updateBadge();  
});

chrome.browserAction.onClicked.addListener(function(tab) {
  var query = {'url': chrome.extension.getURL('view.html')};
  chrome.tabs.query(query, handleViewQuery);
});

})(this, model);