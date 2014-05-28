
/*
Primary todo: 

1. decouple subscribing and updating
2. refator update to start with feed id
3. code subscribe for multiple contexts, it is 
an all around insert. it should do existence check,
and also be callable in several contexts (importing opml files,
subscribing visually, online or offline, polling). Should also 
do notifications from here.

Note on the visual subscribe, not sure because how to do it 
because we want the preview step but we want to check 
existence prior to it, right? So this should provide a 
check if exists feature that the visual subscribe can choose 
to call before calling subscribe. or rather, a flag that is passed 
in, and it iether generates a preview for the callback and does 
not attempt to insert, or it inserts. But, if we have done the work of 
gathering the data for the preview then we want to avoid a second fetch.

*/


// TODO: use better name. Think about search engine modules, 
// like crawler or indexer.

// TODO: should just accept url as the parameter into of a feed object? but note, will that 
// affect the logic of putFeed? Also affects the logic of the object in the callback.

// TODO: should I really be doing all of the entry updates in a single transaction? Why?
// Maybe it makes more sense to have these operate independently? Maybe have an 
// entry updater object that is separate from the feed updater object?

// TODO: I should not be getting the readable names for error messages here, I should
// just be passing back error codes or exception objects. It is the responsibility of the 
// final caller to map codes to human readable strings.


// TODO: as a minor improvement to the continuation passing style, just use
// an object to store the params at each stage and pass just the object. Probably
// call it context or something.


var feedUpdater = {};

// Update a feed
feedUpdater.updateFeed = function(feed, callback, timeout, contentFilterRules) {
  fetcher.fetch(feed.url, function(responseXML) {
    feedUpdater.onFeedFetched(feed, callback, contentFilterRules, responseXML);
  }, function(err) {
    feedUpdater.onFetchError(err, feed, callback);
  }, timeout);
};

feedUpdater.onFetchError = function(err, feed, callback) {
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

feedUpdater.onFeedFetched = function(feed, callback, contentFilterRules, responseXML) {
  var fetchedFeed;

  // Transform the responseXML into a JSON object
  try {
    fetchedFeed = xml2json.transform(responseXML);
  } catch(exception) {
    feed.error = exception.message;
    callback(feed, 0, 0);
    return;
  }

  // All feeds must appear in the title index so we must use 
  // an empty string instead of undefined here
  feed.title = fetchedFeed.title || '';

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

  // We connect to the database after the fetch process has occurred because it
  // avoids any strange asynchronous effects regarding the lifetime of an indexedDB
  // database connection object versus an XMLHttpRequest.

  model.connect(function(db) {
    model.putFeed(db, feed, function(puttedFeed) {
      feedUpdater.onPutFeed(db, puttedFeed, callback, fetchedFeed, contentFilterRules);
    });
  });
};

feedUpdater.onPutFeed = function(db, feed, callback, fetchedFeed, contentFilterRules) {

  var entriesProcessed = 0, entriesAdded = 0;
  var entryCount = fetchedFeed.entries.length;

  if(entryCount == 0) {
    // No entries in feed
    // See http://econ.columbia.edu/events/feed 5/2014 as example
    // The bug is that we never call a callback in this case
    callback(feed, 0, 0);
  }

  var onEntryUpdateSuccess = function() {
    entriesAdded++;
    if(++entriesProcessed >= entryCount) {
      callback(feed, entriesProcessed, entriesAdded);
    }
  };

  var onEntryUpdateError = function() {
    if(++entriesProcessed >= entryCount) {
      callback(feed, entriesProcessed, entriesAdded);
    }
  };
  
  

  // Use a single transaction for all the requests

  var store = db.transaction('entry','readwrite').objectStore('entry');

  collections.each(fetchedFeed.entries, function(entry) {
    entry.feedId = feed.id;
    if(feed.link) entry.feedLink = feed.link;
    if(feed.title) entry.feedTitle = feed.title;
    if(feed.feedDate) entry.feedDate = feed.date;

    var hash = model.generateEntryHash(entry);

    // If we could not generate a hash the entry is not storable
    if(!hash) {
      onEntryUpdateError();
      return;
    }

    // Check if an entry with the same hash key already exists and 
    // insert it if it does not.
    feedUpdater.checkEntryHash(store, entry, hash, 
      onEntryUpdateSuccess, onEntryUpdateError, contentFilterRules);
  });
};

// If an entry with the same hash exists, call on error, otherwise forward to updateEntry
feedUpdater.checkEntryHash = function(store, entry, hash, onEntryUpdateSuccess, onEntryUpdateError, contentFilterRules) {

  model.containsEntryHash(store, hash, function(hashedEntry) {
    if(hashedEntry) {
      onEntryUpdateError();
      return;
    }

    entry.hash = hash;

    feedUpdater.updateEntry(store, entry, onEntryUpdateSuccess, onEntryUpdateError, contentFilterRules);
  });
};

// Prep and attempt to store an entry
feedUpdater.updateEntry = function(store, entry, onSuccess, onError, contentFilterRules) {

  model.containsEntryHash(store, entry.hash, function(hashedEntry) {
    if(hashedEntry) {
      onError();
      return;
    }

    var newEntry = {};
    newEntry.hash = entry.hash;
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