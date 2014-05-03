// Feed update lib

var feedUpdater = {};

// Starts updating a single feed
feedUpdater.update = function(db, feed, callback, timeout) {
  var entriesProcessed = 0;
  var entriesAdded = 0;
  
  fetcher.fetchFeed(feed.url, function(fetchedFeed) {

    if(fetchedFeed.error) {
    
      // Set the error so caller can respond to it
      feed.error = fetchedFeed.error;
      callback(feed, 0, 0);
      return;
    }
    
    if(fetchedFeed.title) {
      feed.title = fetchedFeed.title;
    }

    if(fetchedFeed.link) {
      feed.link = fetchedFeed.link;
    }
    
    if(fetchedFeed.date) {
      var feedDate = parseDate(fetchedFeed.date);
      if(feedDate) {
        feed.date = feedDate.getTime();
      }
    }

    var entryCount = fetchedFeed.entries.length;

    model.insertOrUpdateFeed(db, feed, function(feed) {

      
      var entryUpdated = function() {
        // TODO: what if entryCount is 0? Use >= here?
        if(++entriesProcessed == entryCount) {
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

      each(fetchedFeed.entries, function(entry) {
        entry.feedId = feed.id;

        if(feed.link) {
          entry.feedLink = feed.link;
        }
        
        // Store feed title per entry for later rendering
        // (denormalization)
        entry.feedTitle = feed.title;
        entry.feedDate = feed.date;
        
        feedUpdater.updateEntry(db, entry, onEntryUpdateSuccess, onEntryUpdateError);
      });
      
    });

  }, timeout);
};

// Prep and attempt to store an entry
feedUpdater.updateEntry = function(db, entry, onSuccess, onError) {

  var newEntry = {};

  newEntry.id = model.generateEntryId(entry);
  if(!newEntry.id) {
    console.log('Could not generate id for entry %s', entry);
    onError();
    return;
  }

  newEntry.baseURI = entry.feedLink;
  newEntry.feed = entry.feedId;
  newEntry.read = model.READ_STATE.UNREAD;
  newEntry.feedTitle = entry.feedTitle;

  if(entry.author) {
    newEntry.author = entry.author;
  }

  if(entry.link) {
    newEntry.link = entry.link;
  }

  if(entry.title) {
    newEntry.title = entry.title;
  }

  var pubdate = parseDate(entry.pubdate);
  if(pubdate) {
    newEntry.pubdate = pubdate.getTime();
  } else if(entry.feedDate) {
    newEntry.pubdate = entry.feedDate;
  }

  if(entry.content) {
      
      // Sanitize the content pre storage
      var doc = parseHTML(entry.content);
      var sanitizedDOM = sanitize(entry.feedLink, doc);
      if(sanitizedDOM) {
        newEntry.content = sanitizedDOM.body.innerHTML;
      }
  }
  
  newEntry.fetched = (new Date()).getTime();
  model.addEntry(db, newEntry, onSuccess, onError);
};