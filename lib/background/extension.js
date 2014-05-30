var extension = {};

extension.viewURL = chrome.extension.getURL('view.html');
extension.newTabURL = 'chrome://newtab/';
extension.viewTabQuery = {'url': extension.viewURL};
extension.POLL_INTERVAL = 20;

extension.onStartup = function() {
  chrome.alarms.create('poll', {periodInMinutes: extension.POLL_INTERVAL});  
  extension.updateBadge();
};

extension.onInstalled = function() {
    extension.setBadgeText(0);
};

extension.onAlarm = function(alarm) {
  if('poll' == alarm.name) {
    polling.start();
  }
};

extension.updateBadge =  function() {
  model.connect(function(db) {
    model.countUnread(db, extension.setBadgeText);
  });
};

extension.setBadgeText = function(count) {
  count = parseInt(count) || 0;
  chrome.browserAction.setBadgeText({text: count.toString()});
};

extension.onClicked = function() {
  chrome.tabs.query(extension.viewTabQuery, extension.activateOrCheckNewTab);
};

// Either updates the extisting view or searches for the newtab tab
extension.activateOrCheckNewTab = function(tabs) {
  if(tabs.length) {
    chrome.tabs.update(tabs[0].id, {active:true});
  } else {
    chrome.tabs.query({url: extension.newTabURL}, extension.createOrUpdateTab);
  }
};

// Replaces the existing newtab with the view, or creates a new tab
extension.createOrUpdateTab = function(tabs) {
  if(tabs.length) {
    chrome.tabs.update(tabs[0].id, {active:true,url: extension.viewURL});
  } else {
    chrome.tabs.create({url: extension.viewURL});
  }  
};

extension.notify = function(message) {
  var manifest = chrome.runtime.getManifest();
  var options = {
    id: '',
    type:'basic',
    title: manifest.name || 'Untitled',
    iconUrl:'/img/rss_icon_trans.gif',
    message:message
  };

  if(localStorage.ENABLE_NOTIFICATIONS) {
    chrome.notifications.create(options.id, options);
  } else {
    console.log('Suppressing notification of message: "%s"',options.message);
  }
};

extension.onMessage = function(message) {
  if('subscribe' == message.type) {
    extension.updateBadge();
  } else if('unsubscribe' == message.type) {
    extension.updateBadge();
  } else if('pollCompleted' == message.type) {
    console.log('Polling completed. Processed %s feeds. Added %s entries. %s seconds elapsed.', 
      message.feedsProcessed, message.entriesAdded, message.elapsed);
    extension.updateBadge();
    
    // Only notify if entries were added.
    if(message.entriesAdded) {
      extension.notify(message.entriesAdded + ' new articles added.');  
    }
  } else {
    console.log('extension.onMessage unhandled: %s', JSON.stringify(message));
  } 
};

extension.getManifest = function() {
  return chrome.runtime.getManifest();
};

extension.sendMessage = function(message) {
  chrome.runtime.sendMessage(message);
};

chrome.runtime.onMessage.addListener(extension.onMessage);
chrome.browserAction.onClicked.addListener(extension.onClicked);
chrome.alarms.onAlarm.addListener(extension.onAlarm);
chrome.runtime.onInstalled.addListener(extension.onInstalled);
chrome.runtime.onStartup.addListener(extension.onStartup);