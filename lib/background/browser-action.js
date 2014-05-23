
var browserAction = {};

//Updates the badge text to the number of unread messages
browserAction.updateBadge = function() {
  model.connect(browserAction.onUpdateBadgeConnect_);
};

browserAction.onUpdateBadgeConnect_ = function(db) {
  model.countUnread(db, browserAction.setBadgeText_);
};

browserAction.setBadgeText_ = function(count) {
  count = parseInt(count) || 0;
  chrome.browserAction.setBadgeText({'text': count.toString()});
};


// Setup the click listener
browserAction.viewURL_ = chrome.extension.getURL('view.html');
browserAction.newTabURL_ = 'chrome://newtab/';
browserAction.viewTabQuery_ = {'url': browserAction.viewURL_};

browserAction.onclick_ = function() {
  chrome.tabs.query(browserAction.viewTabQuery_, browserAction.activateOrCheckNewTab_);
};

// Either updates the extisting view or searches for the newtab tab
browserAction.activateOrCheckNewTab_ = function(tabs) {
  if(tabs.length) {
    chrome.tabs.update(tabs[0].id, {'active':true});
  } else {
    chrome.tabs.query({'url': browserAction.newTabURL_}, browserAction.createOrUpdateTab_);
  }
};

// Replaces the existing newtab with the view, or creates a new tab
browserAction.createOrUpdateTab_ = function(tabs) {
  if(tabs.length) {
    chrome.tabs.update(tabs[0].id, {'active':true,'url': browserAction.viewURL_});
  } else {
    chrome.tabs.create({'url': browserAction.viewURL_});
  }  
};


// Bindings
chrome.runtime.onStartup.addListener(browserAction.updateBadge);
chrome.runtime.onInstalled.addListener(browserAction.setBadgeText_);
chrome.browserAction.onClicked.addListener(browserAction.onclick_);