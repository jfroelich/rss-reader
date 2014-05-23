// TODO: use better name. Think about search engine modules, 
// like crawler or indexer.

var feedUpdater = {};

// Starts updating a single feed
feedUpdater.updateFeed = function(db, feed, callback, timeout, contentFilterRules) {
  
  var entriesProcessed = 0, entriesAdded = 0;

  var fetchErrorHandler = function(err) {
    var url = err.url;
    if(err.type == 'unknown') {
      feed.error = 'The request to "'+url+'" encountered an unknown error.';
    } else if(err.type == 'abort') {
      feed.error = 'The request to "' + url + '" was aborted.';
    } else if(err.type == 'timeout') {
      feed.error = 'The request to "' + url + '" took longer than '+err.timeout+'ms to complete.';
    } else if(err.type == 'status') {
      feed.error = 'The request to "'+ url+'" returned an invalid response (' +
        err.status + ' ' + err.statusText + ').';
    } else if(err.type == 'contentType') {
      feed.error = 'The request to "'+ url+'" did not return a valid content type ('+err.contentType+').';
    } else if(err.type == 'undefinedResponseXML') {
      feed.error = 'The request to "'+url+'" did not return an XML document.';
    } else if(err.type == 'undefinedDocumentElement') {
      feed.error = 'The request to "'+ url+'" did not return a valid XML document.';
    }

    callback(feed, 0, 0);
  };

  fetcher.fetch(feed.url, function(responseXML) {

    var fetchedFeed;
    try {
      fetchedFeed = xml2json.transform(responseXML);
    } catch(exception) {
      feed.error = exception.message;
      callback(feed, 0, 0);
      return;
    }


    // feed.title is required so that all feeds appear 
    // in the title index.
    feed.title = fetchedFeed.title || 'Untitled';

    if(fetchedFeed.link) {
      feed.link = fetchedFeed.link;
    }

    if(fetchedFeed.description) {
      feed.description = fetchedFeed.description;
    }

    if(fetchedFeed.date) {
      var feedDate = dates.parseDate(fetchedFeed.date);
      if(feedDate) {
        feed.date = feedDate.getTime();
      }
    }

    var entryCount = fetchedFeed.entries.length;

    model.insertOrUpdateFeed(db, feed, function(feed) {
      
      var entryUpdated = function() {
        if(++entriesProcessed >= entryCount) {
          callback(feed, entriesProcessed, entriesAdded);
        }
      };

      var onEntryUpdateSuccess = function() {
        entriesAdded++;
        entryUpdated();
      };

      var onEntryUpdateError = function() {
        entryUpdated();
      };
      
      // Use a single transaction for all the entries
      var store = db.transaction('entry','readwrite').objectStore('entry');

      collections.each(fetchedFeed.entries, function(entry) {
        entry.feedId = feed.id;
        if(feed.link) entry.feedLink = feed.link;
        if(feed.title) entry.feedTitle = feed.title;
        if(feed.feedDate) entry.feedDate = feed.date;
        feedUpdater.updateEntry(store, entry, onEntryUpdateSuccess, 
          onEntryUpdateError, contentFilterRules);
      });
    });
  }, fetchErrorHandler, timeout);
};

// Prep and attempt to store an entry
feedUpdater.updateEntry = function(store, entry, onSuccess, onError, contentFilterRules) {
    
  var hash = model.generateEntryHash(entry);

  if(!hash) {
    onError();
    return;
  }

  model.containsEntryHash(store, hash, function(hashedEntry) {
    if(hashedEntry) {
      onError();
      return;
    }

    var newEntry = {};
    newEntry.hash = hash;
    newEntry.feed = entry.feedId;

    newEntry.unread = model.UNREAD;

    if(entry.feedLink) newEntry.baseURI = entry.feedLink;
    if(entry.feedTitle) newEntry.feedTitle = entry.feedTitle;
    if(entry.author) newEntry.author = entry.author;
    if(entry.link) newEntry.link = entry.link;
    if(entry.title) newEntry.title = entry.title;

    var pubdate = dates.parseDate(entry.pubdate);
    if(pubdate) {
      newEntry.pubdate = pubdate.getTime();
    } else if(entry.feedDate) {
      newEntry.pubdate = entry.feedDate;
    }

    if(entry.content) {
        var doc = htmlParser.parse(entry.content);
        sanitizer.sanitize(entry.feedLink, doc, contentFilterRules);
        trimming.trimDocument(doc);
        newEntry.content = doc.innerHTML;
    }

    model.addEntry(store, newEntry, onSuccess, onError);
  });
};

feedUpdater.unsubscribe = function(feedId, callback) {
  
  var onunsubscribe = function() {     
    // Update badge
    browserAction.updateBadge();

    // Broadcast event
    chrome.runtime.sendMessage({'type':'unsubscribe', 'feed': feedId});

    // NOTE: why callback here if I am sending a message?
    // Can't the views just handle the message event? Or does the message
    // only get sent to the first view that handles it?
    if(callback) {
      callback(feedId);
    }
  };
  
  model.connect(function(db) {
    model.unsubscribe(db, feedId, onunsubscribe);
  });
};