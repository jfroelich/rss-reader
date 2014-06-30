/**
 * Feed-related functions
 *
 * TODO: in the future, we should be storing two titles, a
 * human readonable one, and one for sorting when loading. Both
 * addFeed and updateFeed would be refactored.
 *
 * TODO: because i do not validate a feed is live before adding,
 * i need to peroidically identify invalid feeds later.
 * TODO: feed.add no longer sends message when complete so the caller
 * needs to do this.
 * //chrome.runtime.sendMessage({type:'subscribe',feed:feed});
 * TODO: remoteById no longer sends message when complete, caller
 * needs to do this.
 * //chrome.runtime.sendMessage({type:'unsubscribe',feed:id,entriesDeleted:counter});
 * TODO: the caller of feed.update needs to set feed.fetched
 * TODO: the caller of feed.update should pass in last modified
 * date of the remote xml file so we can avoid pointless updates
 * TODO: feed.update should not be changing the date updated unless
 * something actually changed.
 */
var feed = feed || {};

/**
 * Sanitizes the remote feed and then adds it to the feed store
 */
feed.add = function(db, remoteFeed, oncomplete, onerror) {
  console.log('feed.add url %s', remoteFeed.url);

  var storableFeed = {};
  var cleanedFeed = feed.asSanitized(remoteFeed);

  storableFeed.url = remoteFeed.url;

  storableFeed.schemeless = getSchemelessURL(storableFeed.url);

  // Setup the feed's title.
  // TODO: set the human readable and system-usable titles
  // as two properties.

  if(cleanedFeed.title) {
    storableFeed.title = cleanedFeed.title;
  } else {
    // TODO: This is kind of ugly and should be improved.
    // Store an empty string. This is important so that
    // the title index picks up the feed, because the feed list on
    // the options page is displayed based on what the title index
    // contains. Undefined values are excluded from indexedDB indices.
    // So if we stored undefined, the feed would never appear in the
    // list.
    // NOTE: we cannot use url because it is not sanitized.
    // We use element.textContent or element.setAttribute to display
    // the url, but we use element.innerHTML to display the
    // title because titles can contain HTML entities. If we set title
    // to url then we would effectively be using element.innerHTML to
    // display the url which would be an XSS.

    // We could maybe do:
    // storableFeed.title = sanitizeString(remoteFeed.url);
    // but sanitize string is not suited for sanitizing urls
    // and could produce a funky string result.

    storableFeed.title = '';
  }

  if(cleanedFeed.description) {
    storableFeed.description = cleanedFeed.description;
  }

  if(cleanedFeed.link) {
    storableFeed.link =  cleanedFeed.link;
  }

  if(cleanedFeed.date) {
    storableFeed.date = cleanedFeed.date;
  }

  if(remoteFeed.fetched) {
    storableFeed.fetched = remoteFeed.fetched;
  }

  storableFeed.created = Date.now();

  feed.addToStore(db, storableFeed, function() {
    storableFeed.id = this.result;
    storableFeed.entries = remoteFeed.entries;
    entry.mergeAll(db, storableFeed, oncomplete);
  }, onerror);
};

/**
 * Updates the localFeed according to the properties in remoteFeed,
 * merges in any new entries present in the remoteFeed, and then
 * calls oncomplete.
 */
feed.update = function(db, localFeed, remoteFeed, oncomplete) {

  var cleanedFeed = feed.asSanitized(remoteFeed);

  if(cleanedFeed.title) {
    localFeed.title = cleanedFeed.title;
  }

  if(cleanedFeed.description) {
    localFeed.description = cleanedFeed.description;
  }

  if(cleanedFeed.link) {
    localFeed.link = cleanedFeed.link;
  }

  if(cleanedFeed.date) {
    localFeed.date = cleanedFeed.date;
  }

  localFeed.fetched = remoteFeed.fetched;

  localFeed.updated = Date.now();

  feed.putInStore(db, localFeed, function() {
    localFeed.entries = remoteFeed.entries;
    entry.mergeAll(db, localFeed, oncomplete);
  }, console.error);
};

/**
 * Adds a feed to the indexedDB feed store
 */
feed.addToStore = function(db, storableFeed, oncomplete, onerror) {
  var addRequest = db.transaction('feed','readwrite').objectStore('feed').add(storableFeed);
  addRequest.onsuccess = oncomplete;
  addRequest.onerror = onerror;
};

/**
 * Puts a feed into the indexedDB feed store.
 */
feed.putInStore = function(db, storableFeed, oncomplete, onerror) {
  var putRequest = db.transaction('feed','readwrite').objectStore('feed').put(storableFeed);
  putRequest.onsuccess = oncomplete;
  putRequest.onerror = onerror;
};

/**
 * Returns a sanitized version of a remote feed object.
 * The remoteFeed object is not modified. Only certain
 * properties are sanitized and included in the returned object
 */
feed.asSanitized = function(remoteFeed) {
  var output = {};

  // Sanitize the title. Note that this does not sanitize
  // HTML entities in the title.
  var title = feed.asSanitizedString(remoteFeed.title);
  if(title) {
    output.title = title;
  }

  // Sanitize the description. Some feed descriptions contain
  // HTML, but we do not allow that.
  // NOTE: this does not sanitize HTML entities in the description
  var description = feed.asSanitizedString(remoteFeed.description);
  if(description) {
    output.description = description;
  }

  // TODO:  Are we possibly fudging the value of link?
  // For now sanitize it generally but this may need
  // special handling.
  // NOTE: html entities are not sanitized.
  var link = feed.asSanitizedString(remoteFeed.link);
  if(link) {
    output.link = link;
  }

  // Date was prepped by the fetcher to just be a timestamp in ms.
  // This is user-generated in the sense that the date was stored in a string
  // like format in the remote feed. However, the function that parses
  // the feed's XML, and the function that creates a feed object from that
  // XML, change the value into a date. So it would be already sanitized
  //  by the fact that it is parsed into a date and then converted into a
  // timestamp. The parse would not have produced a valid date if there were
  // evil characters, and even then, we are only referencing the
  // value produced by Date.getTime(), so there is 0 chance of XSS.
  // NOTE: we do not, however, bother to check this is a valid timestamp.
  // That is the caller's responsibility. We just pass it along.

  // TODO: since this does not need to be sanitized then we
  // do not need to do this here. The caller should not expect
  // a date property in the output object. date is treated
  // similar to url in how it is assumed to be partly
  // sanitized.

  if(remoteFeed.date) {
    output.date = remoteFeed.date;
  }

  return output;
};

/**
 * Sanitizes a string
 *
 * TODO: should we replace HTML entities after
 * stripping tags? Some entities? All entities?
 *
 */
feed.asSanitizedString = function(str) {

  if(!str) {
    return;
  }

  // Parse the string as HTML and then
  // strip any HTML from it.
  str = stripTags(str);

  // Replace all special characters
  if(str) {
    str = stripControls(str);
  }

  // Replace sequences of multiple whitespace
  // characters with a single space.
  // TODO: this should be a call to a separate function
  // or maybe merged with stripControls
  // (one pass instead of two)
  if(str) {
    str = str.replace(/\s+/,' ');
  }

  // If there is anything left in the string, trim it.
  if(str) {
    str = str.trim();
  }

  // Return the str (which may now be just an empty str)
  return str;
};

/**
 * Gets all feed objects in the feedstore as an array
 */
feed.getAll = function(db, callback) {
  var feeds = [];

  var tx = db.transaction('feed');
  tx.oncomplete = function () {
    callback(feeds);
  }

  tx.objectStore('feed').openCursor().onsuccess = function(event) {
    var cursor = this.result;
    if(cursor) {
      feeds.push(cursor.value);
      cursor.continue();
    }
  };
};

/**
 * Counts the number of feeds in the feed store
 */
feed.countAll = function(db, callback) {
  var feedStore = db.transaction('feed').objectStore('feed');
  feedStore.count().onsuccess = function(event) {
    callback(this.result);
  };
};

/**
 * Removes a feed and its dependencies
 */
feed.removeById = function(db, id, oncomplete) {
  var tx = db.transaction(['entry','feed'],'readwrite');
  tx.objectStore('feed').delete(id).onsuccess = function() {
    entry.removeByFeedId(tx, id, function(numDeleted) {
      oncomplete(id, counter);
    });
  };
};

/**
 * Finds the feed corresponding to the url, without regard
 * to its scheme.
 */
feed.findBySchemelessURL = function(db, url, callback) {
  var schemelessURL = getSchemelessURL(feed.url);
  var schemelessIndex = db.transaction('feed').objectStore('feed').index('schemeless');
  schemelessIndex.get(schemelessURL).onsuccess = function() {
    callback(this.result);
  };
};

feed.forEachFeed = function(db, callback, oncomplete, sortByTitle) {
  var tx = db.transaction('feed');
  tx.oncomplete = oncomplete;

  var store = sortByTitle ? tx.objectStore('feed').index('title') : tx.objectStore('feed');
  store.openCursor().onsuccess = function(event) {
    var cursor = event.target.result;
    if(cursor) {
      callback(cursor.value);
      cursor.continue();
    }
  };
};