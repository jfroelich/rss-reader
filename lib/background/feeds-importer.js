// TODO: DRY violation with parts feedupdater

var feedsImporter = {};

feedsImporter.importOPMLFiles = function(fileList, callback) {

  if(!fileList || !fileList.length) {
    feedsImporter.importFeeds(null, null, callback);
    return;
  }

  var fileCounter = fileList.length, exceptions = [], feedsHash = {};

  var aggregateByURL = function(feed) {
    if(feed.url) feedsHash[feed.url] = feed; 
  };

  var onFileLoad = function(event) {
    try {
      var parsedFeeds = opml.parseString(event.target.result);
      parsedFeeds.forEach(aggregateByURL);
    } catch(exception) {
      exceptions.push(exception);
    }

    // We are guaranteed to process at least one file so fileCounter 
    // will always be positive until it is 0
    if(!--fileCounter) {
      // Counter reached 0, we are done
      feedsImporter.importFeeds(collections.values(feedsHash), exceptions, callback);
    }
  };

  // fileList is an object of type FileList, which is iterable
  // via collections.each because it exposes a length property 
  // and index access syntax (e.g. fileList[index])
  collections.each(fileList, function(file) {
    var reader = new FileReader();
    reader.onload = onFileLoad;
    reader.readAsText(file);
  });
};

feedsImporter.importFeeds = function(feeds, exceptions, callback) {
  var feedsProcessed = 0, feedsAdded = 0;
  callback = callback || function(){};

  if(!feeds || !feeds.length) {
    console.log('feedsImporter.importFeeds exiting early as no feeds found');
    console.dir(exceptions);
    callback(feedsAdded, feedsProcessed, exceptions);  
    return;
  }

  var incrementAndCallbackIfDone = function() {
    feedsProcessed++;
    if(feedsProcessed >= feeds.length) {
      console.log('Imported %s of %s feeds with %s exceptions', 
        feedsAdded, feeds.length, exceptions.length);
      callback(feedsAdded, feeds.length, exceptions);
    }
  };

  model.connect(function(db) {
    feeds.forEach(function(feed) {
      feed.url = feed.url ? feed.url.trim() : '';
      if(!feed.url) {
        incrementAndCallbackIfDone();
        return;
      }

      model.isSubscribed(db, feed.url, function(storedFeed) {
        if(storedFeed) {
          incrementAndCallbackIfDone();
        } else {

          // Feed title must be defined in order for it to appear
          // in the feed list which is based on a title index
          if(!feed.title) {
            feed.title = '';
          }

          model.putFeed(db, feed, function(updatedFeed) {
            
            // TODO: notify the listener this is being done via 
            // a batch subscription context so we do not do something like spam 
            // successful subscription notifications
            
            chrome.runtime.sendMessage({'type':'subscribe','feed':updatedFeed});
            feedsAdded++;
            incrementAndCallbackIfDone();
          });
        }
      });
    });
  });
};