// Polling lib

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

chrome.alarms.onAlarm.addListener(function(alarm) {
  if(alarm.name == 'poll') {
    startPoll();
  }
});

chrome.runtime.onStartup.addListener(function() {
  chrome.alarms.create('poll', {'periodInMinutes': POLL_INTERVAL});
});