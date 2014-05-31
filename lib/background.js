
var background = {};
background.onMessage = function(message) {
  if('subscribe' == message.type) {
    extension.updateBadge();
  } else if('unsubscribe' == message.type) {
    extension.updateBadge();
  } else if('pollCompleted' == message.type) {
    console.log('Polling completed. Processed %s feeds. Added %s entries. %s seconds elapsed.',
      message.feedsProcessed, message.entriesAdded, message.elapsed);
    extension.updateBadge();
    if(message.entriesAdded) {
      extension.notify(message.entriesAdded + ' new articles added.');
    }
  } else {
    console.log('background.onMessage unhandled type %s', message.type);
  }
};

background.onClicked = function() {
  chrome.tabs.query({'url': chrome.extension.getURL('view.html')}, function(tabs) {
    if(tabs.length) {
      chrome.tabs.update(tabs[0].id, {active:true});
    } else {
      chrome.tabs.query({url: 'chrome://newtab/'}, function(tabs) {
        if(tabs.length) {
          chrome.tabs.update(tabs[0].id, 
            {active:true,url: chrome.extension.getURL('view.html')});
        } else {
          chrome.tabs.create({url: chrome.extension.getURL('view.html')});
        }  
      });
    }
  });
};

background.onStartup = function() {
  console.log('onStartup');

  // https://developer.chrome.com/extensions/alarms#method-create
  // Setting delayInMinutes or periodInMinutes to less than 1 will not be honored and will 
  // cause a warning. To help you debug your app or extension, when you've loaded it unpacked, 
  // there's no limit to how often the alarm can fire.
  chrome.alarms.create('poll', {periodInMinutes: 20});
};

background.onInstalled = function() {
  console.log('onInstalled');
  chrome.browserAction.setBadgeText({text: '0'});
};

background.onAlarm = function(alarm) {
  //console.log('onAlarm');
  if('poll' == alarm.name) {
    polling.start();
  }
};

background.onSuspend = function() {
  console.log('Extension suspended');
};

background.onSuspendCanceled = function() {
  console.log('Extension suspend canceled');
};

chrome.runtime.onSuspend.addListener(background.onSuspend);
chrome.runtime.onInstalled.addListener(background.onInstalled);
chrome.runtime.onStartup.addListener(background.onStartup);
chrome.alarms.onAlarm.addListener(background.onAlarm);
chrome.browserAction.onClicked.addListener(background.onClicked);
chrome.runtime.onMessage.addListener(background.onMessage);