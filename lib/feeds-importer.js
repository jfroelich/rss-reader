var feedsImporter = {};
feedsImporter.importOPMLFiles = function(fileList, callback) {

  if(!fileList || !fileList.length) {
    // being explicit for now, could just use callback()
    callback(null,null,null);
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

    if(!--fileCounter) {
      feedsImporter.importFeeds(collections.values(feedsHash), exceptions, callback);
    }
  };

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

  var params = {};
  
  // Explicit for clarity for now.
  params.fetch = params.timeout = params.notify = 0;

  // Just pass along to onSuccessOrError, the error 
  // is just invalid url or url already exists.
  params.onimporterror = onSuccessOrError;

  // subscriptions.add calls  params.oncomplete
  // when done adding.
  params.onImportComplete = function() {
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