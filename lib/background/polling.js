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
  
  var totalEntriesAdded = 0, feedCounter = 0;

  var params = {};
  params.onerror = function(err) {
    console.log('polling error %s', JSON.stringify(err));
  };

  params.oncomplete = function(feed, entriesProcessed, entriesAdded) {
    totalEntriesAdded += entriesAdded;
    if(++feedCounter >= feedCount) {
      localStorage.LAST_POLL_DATE_MS = String(new Date().getTime());
      polling.running_ = false;
      if(feedsProcessed && entriesAdded) {
        extension.sendMessage({type:'pollCompleted',
          entriesAdded:entriesAdded,
          feedsProcessed:feedsProcessed,
          entriesProcessed:entriesProcessed});
      }
    }
  };
  
  model.connect(function(db){
    model.countFeeds(db, function(feedCount) {
      if(feedCount == 0) {
        params.oncomplete(null, 0,0);
        return;
      }

      model.forEachFeed(db, function(feed) {
        params.url = feed.url;
        params.feedId = feed.id;
        params.timeout = 10*1000;
        subscriptions.update(params);
      });
    });
  });
};