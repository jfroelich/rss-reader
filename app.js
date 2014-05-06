// App lib

var POLL_INTERVAL = 20;
var pollRunning = false;

function startPoll() {
  
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
        feedUpdater.update(db, feed, function(feed, entriesProcessed, entriesAdded){
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
  var notification = webkitNotifications.createNotification(
    'img/rss_icon_trans.gif','Josh\'s RSS Reader',message
  );

  notification.show();
}

chrome.browserAction.onClicked.addListener(function(tab) {

  var viewURL = {'url': chrome.extension.getURL('view.html') };

  chrome.tabs.query(viewURL, function(tabs) {
    if(tabs && tabs.length > 0) {
      // The tab for the extension is open. Reload it and mark it 
      // as selected
      
      // There is no longer a need to reload
      //chrome.tabs.reload(tabs[0].id);
      
      chrome.tabs.update(tabs[0].id, {'selected':true});
    } else {
      // Open a new tab and show the extension
      chrome.tabs.create(viewURL);
    }
  });
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