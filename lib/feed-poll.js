
function resetPollActive() {
  delete localStorage.POLL_ACTIVE;
}


/**
 *
 */
function startPolling() {

  var isPollRunning = localStorage.POLL_ACTIVE;

  if(isPollRunning) {
    console.log('Poll already in progress');
    return;
  }

  if(!navigator.onLine) {
    return;
  }

  localStorage.POLL_ACTIVE = '1';

  var totalEntriesAdded = 0, feedCounter = 0, totalEntriesProcessed = 0;
  var startTime = Date.now();
  var feedCounter = 0;
  openDB(onOpenDB);

  function onOpenDB(db) {
    getAllFeeds(db, onGetAllFeeds.bind(db));
  }

  function onGetAllFeeds(feeds) {
    feedCounter = feeds.length;
    if(feedCounter) {
      feeds.forEach(pollFeed, this);
    } else {
      pollCompleted();
    }
  }

  function pollFeed(feed) {
    var params = {};
    params.feed = feed;
    params.fetch = 1;
    params.timeout = 20 * 1000;
    params.db = this;
    params.onerror = function(error) {
      console.log(error);
    };
    params.oncomplete = function(polledFeed, processed,added) {
      totalEntriesProcessed += processed;
      totalEntriesAdded += added;
      if(--feedCounter < 1) {
        pollCompleted();
      }
    };

    updateFeed(params);
  }

  function pollCompleted() {
    delete localStorage.POLL_ACTIVE;
    localStorage.LAST_POLL_DATE_MS = String(Date.now());

    var endTime = Date.now();
    var elapsed = parseFloat(((endTime - startTime)/1000).toFixed(2));

    chrome.runtime.sendMessage({type:'pollCompleted',
      entriesAdded:totalEntriesAdded,
      feedsProcessed:feedCounter,
      entriesProcessed:totalEntriesProcessed,
      elapsed:elapsed});
  }
}