// Polling lib

var polling = {};

// (in minutes)
polling.running_ = false;

// Start the poll
polling.start = function() {

  if(polling.running_) {
    console.log('Poll already in progress');
    return;
  }

  if(!navigator.onLine) {
    console.log('Cannot poll while offline');
    return;
  }

  this.running_ = true;
  this.startTime = new Date().getTime();
  
  var totalEntriesAdded = 0, feedCounter = 0, totalEntriesProcessed = 0;

  var pollcomplete = function() {
    //console.log('complete');
    localStorage.LAST_POLL_DATE_MS = String(Date.now());
    polling.running_ = false;

    var endTime = Date.now();
    var elapsed = parseFloat(((endTime - polling.startTime)/1000).toFixed(2));

    chrome.runtime.sendMessage({type:'pollCompleted',
      entriesAdded:totalEntriesAdded,
      feedsProcessed:feedCounter,
      entriesProcessed:totalEntriesProcessed,
      elapsed:elapsed});
  };

  model.connect(function(db){
    db.transaction('feed').objectStore('feed').count().onsuccess = function(event) {
      var feedCount = event.target.result;
      if(!feedCount) {
        pollcomplete();
        return;
      }

      model.forEachFeed(db, function(feed) {
        
        var updater = new FeedUpdate();
        updater.db = db;
        updater.fetch = 1;
        updater.timeout = 20*1000;
        
        updater.onerror = function(err) {
          if(err) {
            if(err.type == 'timeout') {
              //console.log('Request timed out for %s', err.url);
            } else {
              console.dir(err);
            }
          }
        };
        
        updater.oncomplete = function(feed, entriesProcessed, entriesAdded) {
          totalEntriesProcessed += entriesProcessed;
          totalEntriesAdded += entriesAdded;
          if(++feedCounter >= feedCount) {
            pollcomplete();
          }
        };
        updater.update(feed.id, feed.url);
      });
    };
  });
};