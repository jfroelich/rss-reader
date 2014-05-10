// App lib

var POLL_INTERVAL = 20;
var pollRunning = false;

function startPoll() {
  
  if(navigator.hasOwnProperty('onLine') && !navigator.onLine) {
    console.log('offline, poll cancelled');
    pollRunning = false;
    return;
  }
  
  if(pollRunning) {
    console.log('Poll already in progress');
    return;
  }
  
  pollRunning = true;
  
  var totalEntriesAdded = 0, feedCounter = 0;
  
  model.connect(function(db){
    model.countFeeds(db, function(feedCount) {
      if(feedCount == 0) {
        pollCompleted(feedCount, totalEntriesAdded);
        return;
      }

      model.forEachFeed(db, function(feed) {
        updateFeed(db, feed, function(feed, entriesProcessed, entriesAdded){
          
          if(feed.error) { console.log('Polling error: %s', feed.error); }
          
          totalEntriesAdded += entriesAdded;
          if(++feedCounter == feedCount) {
            pollCompleted(feedCount, totalEntriesAdded);
          }
        });
      });
    });
  });
}

function pollCompleted(feedsProcessed, entriesAdded) {

  console.log('Polling completed. Processed %s feeds. Added %s entries.', 
    feedsProcessed, entriesAdded);

  if(feedsProcessed && entriesAdded) {
    updateBadge();
    showNotification(entriesAdded + ' new articles added.');
    chrome.runtime.sendMessage({'type':'pollCompleted','entriesAdded':entriesAdded});
  }

  localStorage.LAST_POLL_DATE_MS = String(new Date().getTime());
  pollRunning = false;
}

function updateBadge() {
  model.connect(function(db){
    model.countUnread(db, function(count) {
      chrome.browserAction.setBadgeText({'text': count.toString()});
    });
  });
}

function showNotification(message) {
  chrome.notifications.getPermissionLevel(function(level) {
    if(level == 'granted') {
      var id = '';
      chrome.notifications.create(id, {
        'type':'basic',
        'title':'Josh\'s RSS Reader',
        'iconUrl':'img/rss_icon_trans.gif',
        'message':message
      }, function(notificationId){});
    } else {
      console.log('This extension is not authorized to show notifications.');
    }
  });
}

chrome.browserAction.onClicked.addListener(function(tab) {
  var viewURL = chrome.extension.getURL('view.html');
  var newTabURL = 'chrome://newtab/';
  var newTabQueryHandler = function(newTabs){
    if(newTabs.length > 0) {
      chrome.tabs.update(newTabs[0].id, {'active':true,'url': viewURL});
    } else {
      chrome.tabs.create({'url': viewURL});
    }
  };

  var viewQueryHandler = function(tabs) {
    if(tabs.length > 0) {
      chrome.tabs.update(tabs[0].id, {'active':true});
    } else {
      chrome.tabs.query({'url':newTabURL}, newTabQueryHandler);
    }
  };

  chrome.tabs.query({'url': viewURL}, viewQueryHandler);
});

chrome.runtime.onInstalled.addListener(function(){
  chrome.browserAction.setBadgeText({'text':"0"});
});

chrome.runtime.onStartup.addListener(function() {
  updateBadge();
  chrome.alarms.create('poll', {'periodInMinutes': POLL_INTERVAL});
});

chrome.alarms.onAlarm.addListener(function(alarm) {
  if(alarm.name == 'poll') {
    startPoll();
  }
});