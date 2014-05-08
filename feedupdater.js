// Feed update lib

// Starts updating a single feed
function updateFeed(db, feed, callback, timeout) {
  var entriesProcessed = 0, entriesAdded = 0;
  fetchFeed(feed.url, function(responseXML) {

    var fetchedFeed = parseFeedXML(responseXML);

    if(fetchedFeed.error) {
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
      
      var store = db.transaction('entry','readwrite').objectStore('entry');
      
      each(fetchedFeed.entries, function(entry) {
        entry.feedId = feed.id;
        if(feed.link) entry.feedLink = feed.link;
        if(feed.title) entry.feedTitle = feed.title;
        if(feed.feedDate) entry.feedDate = feed.date;
        updateEntry(store, entry, onEntryUpdateSuccess, onEntryUpdateError);
      });
    });
  }, timeout);
};

// Prep and attempt to store an entry
function updateEntry(store, entry, onSuccess, onError) {
  var hash = model.generateEntryHash(entry);

  if(!hash) {
    console.log('Could not generate hash for entry %s', entry);
    onError();
    return;
  }

  model.containsEntryHash(store, hash, function(hashedEntry) {
    if(hashedEntry) {
      console.log('entries already contains %s', hash);
      onError();
      return;
    }

    var newEntry = {};
    newEntry.hash = hash;
    newEntry.feed = entry.feedId;
    newEntry.read = model.READ_STATE.UNREAD;
    if(entry.feedLink) newEntry.baseURI = entry.feedLink;
    if(entry.feedTitle) newEntry.feedTitle = entry.feedTitle;
    if(entry.author) newEntry.author = entry.author;
    if(entry.link) newEntry.link = entry.link;
    if(entry.title) newEntry.title = entry.title;

    var pubdate = parseDate(entry.pubdate);
    if(pubdate) {
      newEntry.pubdate = pubdate.getTime();
    } else if(entry.feedDate) {
      newEntry.pubdate = entry.feedDate;
    }

    if(entry.content) {
        var doc = parseHTML(entry.content);
        var sanitizedDOM = sanitize(entry.feedLink, doc);
        if(sanitizedDOM) {
          newEntry.content = sanitizedDOM.body.innerHTML;
        }
    }

    model.addEntry(store, newEntry, onSuccess, onError);
  });
};