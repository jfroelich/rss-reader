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
    localStorage.LAST_POLL_DATE_MS = String(new Date().getTime());
    polling.running_ = false;

    var endTime = new Date().getTime();
    var elapsed = ((endTime - polling.startTime)/1000).toFixed(2);

    extension.sendMessage({type:'pollCompleted',
      entriesAdded:totalEntriesAdded,
      feedsProcessed:feedCounter,
      entriesProcessed:totalEntriesProcessed,
      elapsed:elapsed});
  };

  var params = {};

  
  params.cfrules = contentFiltering.loadRules();
  params.notify = 0;
  params.fetch = 1;

  model.connect(function(db){
    model.countFeeds(db, function(feedCount) {
      if(!feedCount) {
        //console.log('no feeds to update');
        pollcomplete();
        return;
      }

      model.forEachFeed(db, function(feed) {
        params.oncomplete = function(feed, entriesProcessed, entriesAdded) {
          totalEntriesProcessed += entriesProcessed;
          totalEntriesAdded += entriesAdded;
          if(++feedCounter >= feedCount) {
            pollcomplete();
          }
        };

        params.onerror = function(err) {
          console.log('polling error %s', JSON.stringify(err));
          // added this to make sure pollcomplete getes called 
          // in event of error.
          if(++feedCounter >= feedCount) {
            pollcomplete();
          }
        };

        params.db = db;
        params.url = feed.url;
        params.feedId = feed.id;
        params.timeout = 10*1000;
        subscriptions.update(params);
      });
    });
  });
  

};