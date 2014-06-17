var feedsImporter = {};
feedsImporter.importOPMLFiles = function(files, callback) {

  if(!files || !files.length) {
    callback();
    return;
  }

  var fileCounter = files.length, exceptions = [], feedsHash = {};

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

    if(!--fileCounter) {
      feedsImporter.importFeeds(util.values(feedsHash), exceptions, callback);
    }
  };

  util.each(files, function(file) {
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

  var params = {};
  params.onerror = onSuccessOrError;
  params.oncomplete = function() {
    feedsAdded++;
    onSuccessOrError();
  };

  var onSuccessOrError = function() {
    feedsProcessed++;
    if(feedsProcessed >= feeds.length) {
      console.log('Imported %s of %s feeds with %s exceptions', 
        feedsAdded, feeds.length, exceptions.length);
      callback(feedsAdded, feeds.length, exceptions);
    }
  };

  model.connect(function(db) {
    
    
    // TODO: this is out of date, subscriptions.js 
    // is deprecated. switch to use feed-update
    
    // Pack in an open db conn so subscriptions.add
    // can reuse it per call.
    params.db = db;
    feeds.forEach(function(feed) {
      params.url = feed.url ? feed.url.trim() : '';
      if(params.url) {
        subscriptions.add(params);  
      }
    });
  });
};