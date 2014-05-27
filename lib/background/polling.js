// Polling lib

var polling = {};

// (in minutes)
polling.INTERVAL_ = 20;
polling.running_ = false;

// For XMLHttpRequests (in milliseconds)
polling.REQUEST_TIMEOUT_ = 10 * 1000;

// Start the poll
polling.start = function() {

  if(this.running_) {
    
    // TODO: generate a runtime message for interested listeners?
    
    console.log('Poll already in progress');
    return;
  }

  if(!navigator.onLine) {
    
    // TODO: generate a runtime message for interested listeners?
    
    console.log('Cannot poll while offline');
    return;
  }

  this.running_ = true;
  
  var totalEntriesAdded = 0, feedCounter = 0;

  var contentFilterRules = contentFiltering.loadRules();
  
  model.connect(function(db){
    model.countFeeds(db, function(feedCount) {
      if(feedCount == 0) {
        polling.oncomplete_(feedCount, totalEntriesAdded);
        return;
      }

      model.forEachFeed(db, function(feed) {

        feedUpdater.updateFeed(feed, function(feed, entriesProcessed, entriesAdded){

          if(feed.error) { 
            console.log('Polling error: %s', feed.error); 
          }

          totalEntriesAdded += entriesAdded;
          if(++feedCounter == feedCount) {
            polling.oncomplete_(feedCount, totalEntriesAdded);
          }
        }, polling.REQUEST_TIMEOUT_, contentFilterRules);
      });
    });
  });
}

polling.oncomplete_ = function(feedsProcessed, entriesAdded) {
  console.log('Polling completed. Processed %s feeds. Added %s entries.', 
    feedsProcessed, entriesAdded);
  
  if(feedsProcessed && entriesAdded) {
    browserAction.updateBadge();
    notifications.show(entriesAdded + ' new articles added.');

    chrome.runtime.sendMessage({type:'pollCompleted',entriesAdded:entriesAdded});
  }

  localStorage.LAST_POLL_DATE_MS = String(new Date().getTime());
  this.running_ = false;
};

polling.ALARM_NAME_ = 'poll';
polling.onalarm_ = function(alarm) {
  if(alarm.name == polling.ALARM_NAME_) {
    polling.start();
  }
};

polling.ALARM_OPTIONS_ = {periodInMinutes: polling.INTERVAL_};
polling.onstartup_ = function() {
  chrome.alarms.create(polling.ALARM_NAME_, polling.ALARM_OPTIONS_);
}

// Bindings
chrome.alarms.onAlarm.addListener(polling.onalarm_);

// TODO:does this belong in a central startup module?
chrome.runtime.onStartup.addListener(polling.onstartup_);