// Browser action lib

function updateBadge() {
  model.connect(function(db){
    model.countUnread(db, function(count) {
      chrome.browserAction.setBadgeText({'text': count.toString()});
    });
  });
}

function viewQueryHandler(tabs) {
  if(tabs.length > 0) {
    chrome.tabs.update(tabs[0].id, {'active':true});
  } else {
    chrome.tabs.query({'url': 'chrome://newtab/'}, newTabQueryHandler);
  }
}

function newTabQueryHandler(newTabs){
  if(newTabs.length > 0) {
    chrome.tabs.update(newTabs[0].id, {'active':true,'url': chrome.extension.getURL('view.html')});
  } else {
    chrome.tabs.create({'url': chrome.extension.getURL('view.html')});
  }
}

chrome.runtime.onInstalled.addListener(function() {
    chrome.browserAction.setBadgeText({'text':"0"});
});

chrome.runtime.onStartup.addListener(function() {
  updateBadge();  
});

chrome.browserAction.onClicked.addListener(function(tab) {
  chrome.tabs.query(
    {'url': chrome.extension.getURL('view.html')}, 
    viewQueryHandler
  );
});