
var backup = {};


/**
 * Parses OPML files into an array of feeds
 * and then hands off to restoreFromFeedsArray
 *
 * @param files a FileList object
 * @param callback called when completed
 */
backup.importOPMLFiles = function(files, callback) {

  if(!files || !files.length) {
    // 0 feeds processed, 0 feeds added, no exceptions
    callback();
    return;
  }

  var fileCounter = files.length,
      exceptions = [],
      feedsHash = {};

  Array.prototype.forEach.call(files, readFile);

  function readFile(file) {
    var reader = new FileReader();
    reader.onload = onFileLoad;
    reader.readAsText(file);
  }

  // TODO: rather than aggregate every
  // file, just aggregate at the end

  function onFileLoad(event) {
    try {
      var text = this.result;
      var feeds = opml.parse(text) || [];
      feeds.forEach(aggregateByURL);
    } catch(exception) {
      exceptions.push(exception);
    }

    if(--fileCounter == 0) {
      var values = util.values(feedsHash);
      backup.importFeeds(values, exceptions, callback);
    }
  }

  function aggregateByURL(feed) {
    if(feed.url) {
      feedsHash[feed.url] = feed;
    }
  }
};

/**
 */
backup.importFeeds = function(feeds, exceptions, callback) {
  var feedsProcessed = 0, feedsAdded = 0;
  if(!feeds || !feeds.length) {
    return callback(0, 0, exceptions);
  }

  database.connect(function(db) {
    feeds.forEach(function(feedObject) {

      // TODO: this has not been tested

      feed.add(db, feedObject, function() {
        feedsAdded++;
        onSuccessOrError();
      }, onSuccessOrError);
    });
  });

  function onSuccessOrError() {
    feedsProcessed++;
    if(feedsProcessed >= feeds.length) {

      // TODO: do a notification here? or in the caller?

      callback(feedsAdded, feedsProcessed, exceptions);
    }
  }
};

backup.exportOPMLString = function(onStringBuilt) {

  database.connect(function(db) {
    feed.getAll(db, onGetAllFeeds);
  });

  function onGetAllFeeds(feeds) {
    var xmlDocument = opml.toXML(feeds,'subscriptions.xml');
    var serializer = new XMLSerializer();
    var str = serializer.serializeToString(xmlDocument);
    onStringBuilt(str);
  }
};