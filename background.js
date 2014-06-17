
var background = {};
background.onMessage = function(message) {
  if('subscribe' == message.type) {
    util.updateBadge();
  } else if('unsubscribe' == message.type) {
    util.updateBadge();
  } else if('pollCompleted' == message.type) {
    //console.log('Polling completed. Processed %s feeds. Added %s entries. %s seconds elapsed.',
    //  message.feedsProcessed, message.entriesAdded, message.elapsed);
    util.updateBadge();
    if(message.entriesAdded) {
      util.notify(message.entriesAdded + ' new articles added.');
    }
  }
};

background.onClicked = function() {
  
  var viewURL = chrome.extension.getURL('slides.html');
  
  chrome.tabs.query({'url': viewURL}, function(tabs) {
    if(tabs.length) {
      chrome.tabs.update(tabs[0].id, {active:true});
    } else {
      chrome.tabs.query({url: 'chrome://newtab/'}, function(tabs) {
        if(tabs.length) 
          chrome.tabs.update(tabs[0].id, {active:true,url: viewURL});
        else
          chrome.tabs.create({url: viewURL});
      });
    }
  });
};

background.onStartup = function() {
  console.log('onStartup');
  chrome.alarms.create('poll', {periodInMinutes: 20});
};

background.onInstalled = function() {
  //console.log('onInstalled');
};

background.INACTIVITY_INTERVAL = 60*5;

background.onAlarm = function(alarm) {
  if('poll' == alarm.name) {
    chrome.permissions.contains({permissions: ['idle']}, function(permitted) {
      if(permitted) {
        chrome.idle.queryState(background.INACTIVITY_INTERVAL, function (newState) {
          if(newState == 'locked' || newState == 'idle') {
            polling.start();
          }
        });
      } else {
        polling.start();
      }
    });
  }
};

background.onSuspend = function() {
  console.log('Extension suspended');
};

background.onSuspendCanceled = function() {
  //console.log('Extension suspend canceled');
};

chrome.runtime.onSuspend.addListener(background.onSuspend);
chrome.runtime.onInstalled.addListener(background.onInstalled);
chrome.runtime.onStartup.addListener(background.onStartup);
chrome.alarms.onAlarm.addListener(background.onAlarm);
chrome.browserAction.onClicked.addListener(background.onClicked);
chrome.runtime.onMessage.addListener(background.onMessage);


// Calls here are onload/onreload
util.updateBadge();