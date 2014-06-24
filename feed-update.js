/**
 * Now that I think about it, updating can be completely
 * decoupled from inserting.
 *
 * Furthermore, inserting can be decoupled from fetching.
 *
 * Fetching can be decoupled from converting from xml.
 *
 * It is the responsibility of the callers, not this,
 * to wire these functions together. I just have to make
 * it easy to wire the steps together.
 *
 * So even this rewrite is wrong.
 */


// props: timeout, db, notify, fetch, onerror, oncomplete
function insertUpdateFeed(params) {

  var url = stripControls(params.url.trim());
  var feedId = params.id;

  // The presence of a feedId is what signifies an update.
  var isInsert = !feedId;
  var shouldFetch = params.fetch;
  var oncomplete = params.oncomplete;
  var onerror = params.onerror || noop;
  var timeout = params.timeout;
  var augmentImageData = params.augmentImageData;
  var rewriteLinks = params.rewriteLinks;
  var augmentEntries = params.augmentEntries;

  if(isInsert) {
    if(!isValidURLString(url)) {
      return onerror({type:'invalid-url',url:url});
    }

    // Start by checking whether we are already subscribed
    if(params.db) {
      fetchIfNotExists(params.db);
    } else {
      openDB(function(db) {
        fetchIfNotExists(db);
      });
    }
  } else {
    fetch();
  }

  function insertUpdateCompleted() {

    oncomplete();
  }

  function checkIfExists(db) {
    // Check whether a corresponding feed exists in the database
    // The equality test is done without the scheme
    var schemelessURL = getSchemelessURL(url);
    var schemelessIndex = db.transaction('feed').objectStore('feed').index('schemeless');
    schemelessIndex.get(schemelessURL).onsuccess = onCheckedIfExists;
  }

  function onCheckedIfExists() {
    if(this.result) {
      onerror({type:'exists', url:url, feed:this.result});
    } else {
      fetch();
    }
  }

  function fetch() {
    if(shouldFetch && navigator.onLine) {
      fetchFeed({
        url: url,
        oncomplete: onFetchComplete,
        onerror: onerror,
        timeout: timeout,
        augmentEntries: augmentEntries,
        augmentImageData: augmentImageData,
        rewriteLinks: rewriteLinks
      });
    } else if(isInsert) {
      // Insert while not online or not should fetch. This
      // could be a single import, a batch import, or
      // subscribe while offline. Reconnect because xml is
      // on a diff timer.
      // TODO: provide a default title?
      openDB(function(db) {
        insertFeed(db, {url:url});
      });
    } else {
      // Tried to update while we are offline.
      insertUpdateCompleted();
    }
  }

  function onFetchComplete(fetchedFeed) {
    // NOTE: fetchedFeed will be defined, otherwise
    // fetchFeed would routed us to onerror

    // Stash the url (??)
    fetchedFeed.url = url;

    // Set the date fetched to now
    fetchedFeed.fetched = Date.now();

    // XHR on diff timer, so reconnect and forward
    // to insert/update
    openDB(function(db) {
      if(isInsert) {
        insertFeed(db, fetchedFeed);
      } else {
        // TODO: this might not be needed
        fetchedFeed.id = feedId;
        updateFeed(db, fetchedFeed);
      }
    });
  }

  // TODO: this can be in global scope
  function getStorableFeed(otherFeed) {

  }

  function insertFeed(db, fetchedFeed) {
    var storableFeed = getStorableFeed(fetchedFeed);
  }
}




FeedUpdate.prototype.insertFeed = function() {
  console.log('Inserting %s', this.url);

  this.fetchedFeed.url = this.url;
  this.storedFeed = this.getStorableFeed(this.fetchedFeed);
  this.storedFeed.created = Date.now();

  var self = this;
  var feedStore = this.db.transaction('feed','readwrite').objectStore('feed');

  feedStore.add(this.storedFeed).onsuccess = function(event) {

    console.log('Inserted %s, new id is %s', self.url, this.result);

    self.storedFeed.id = this.result;

    if(self.fetchedFeed && self.fetchedFeed.fetched) {
      self.addEntries();
    } else {
      self.dispatchOncomplete();
    }
  };
};

FeedUpdate.prototype.updateFeed = function() {

  //console.log('FeedUpdate.updateFeed id %s url %s', this.feedId, this.url);

  var self = this;

  this.fetchedFeed.id = this.feedId;
  this.fetchedFeed.url = this.url;
  this.storedFeed = this.getStorableFeed(this.fetchedFeed);

  var tx = this.db.transaction('feed','readwrite');
  var feedStore = tx.objectStore('feed');
  feedStore.get(this.feedId).onsuccess = function(event) {
    var existingFeed = this.result;

    if(!existingFeed) {
      self.onerror({type:'feednotfound',feedId: self.feedId});
      return self.dispatchOncomplete();
    }

    if(self.storedFeed.title) existingFeed.title = self.storedFeed.title;
    if(self.storedFeed.description)
      existingFeed.description = self.storedFeed.description;
    if(self.storedFeed.date) existingFeed.date = self.storedFeed.date;
    if(self.storedFeed.link) existingFeed.link = self.storedFeed.link;
    if(self.storedFeed.fetched) existingFeed.fetched = self.storedFeed.fetched;

    existingFeed.updated = Date.now();
    if(!existingFeed.created) existingFeed.created = existingFeed.updated;

    // Note: not 100% sure why, but we must bind addEntries to self
    // as 'this' is set to an IDBRequest object.

    feedStore.put(existingFeed).onsuccess = self.addEntries.bind(self);
  };
};

FeedUpdate.prototype.getStorableFeed = function(input) {
  var output = {};

  if(input.id) output.id = input.id;

  output.url = input.url;
  output.schemeless = getSchemelessURL(input.url);

  if(input.title) {
    output.title = stripTags(stripControls(input.title));
  } else {
    output.title = stripTags(stripControls(input.url));
  }

  if(input.description) {
    output.description = stripTags(stripControls(input.description));
  }

  if(input.link) {
    output.link = stripControls(input.link);
  }

  if(input.date) {
    var d = parseDate(stripControls(input.date));
    if(d) output.date = d.getTime();
  }

  if(input.fetched) output.fetched = input.fetched;
  if(input.created) output.created = input.created;
  if(input.updated) output.updated = input.updated;
  return output;
};

FeedUpdate.prototype.addEntries = function() {

  //console.log('FeedUpdate.addEntries %s', this.url);

  if(!this.fetchedFeed || !this.fetchedFeed.entries || !this.fetchedFeed.entries.length) {
    return this.dispatchOncomplete();
  }

  this.entriesProcessed = 0;
  this.entriesAdded = 0;

  var self = this;

  var onUpdateComplete = function() {
    self.entriesProcessed++;
    if(self.entriesProcessed >= self.fetchedFeed.entries.length) {
      self.dispatchOncomplete();
    }
  };

  var onUpdateSuccess = function() {
    self.entriesAdded++;
    onUpdateComplete();
  };

  var onUpdateError = function() {
    onUpdateComplete();
  };

  each(this.fetchedFeed.entries, function(fetchedEntry) {

    var storableEntry = {};
    storableEntry.hash = self.generateEntryHash(fetchedEntry);
    if(!storableEntry.hash) {
      return onUpdateError();
    }

    var tx = self.db.transaction('entry','readwrite');
    var entryStore = tx.objectStore('entry');
    var hashIndex = entryStore.index('hash');

    hashIndex.get(storableEntry.hash).onsuccess = function(event) {
      if(this.result) {
        return onUpdateError();
      }

      if(self.storedFeed.link) storableEntry.feedLink = self.storedFeed.link;
      if(self.storedFeed.title) storableEntry.feedTitle = self.storedFeed.title;

      storableEntry.feed = self.storedFeed.id;
      storableEntry.unread = 1;

      if(fetchedEntry.author) storableEntry.author = fetchedEntry.author;
      if(fetchedEntry.link) storableEntry.link = fetchedEntry.link;
      if(fetchedEntry.title) storableEntry.title = fetchedEntry.title;

      var pubdate = parseDate(fetchedEntry.pubdate);
      if(pubdate) storableEntry.pubdate = pubdate.getTime();
      else if(self.storedFeed.date) storableEntry.pubdate = self.storedFeed.date;

      storableEntry.created = Date.now();

      if(fetchedEntry.content) {
        // We are sanitizing, trimming, and rewriting/resolving urls in real time
        /// on render instead of here.
        storableEntry.content = fetchedEntry.content;
      }

      var addRequest = entryStore.add(storableEntry);
      addRequest.onerror = function() {
        console.log('Failed to add entry %s', storableEntry.link);
        onUpdateError();
      };
      addRequest.onsuccess = function() {
        //console.log('Added entry %s', storableEntry.link);
        onUpdateSuccess();
      };
    };
  });
};

FeedUpdate.prototype.generateEntryHash = function(entry) {
  var seed = entry.link || entry.title || entry.content;
  if(seed) {
    return generateHashCode(seed.split(''));
  }
};

FeedUpdate.prototype.dispatchOncomplete = function() {

  if(this.storedFeed) {
    if(this.actionType == this.CREATE) {
      chrome.runtime.sendMessage({type:'subscribe',feed:this.storedFeed});
    }

    if(this.notify) {
      notify('Subscribed to '+this.storedFeed.title+'. Found '+this.entriesAdded+' new articles.');
    }

    this.oncomplete(this.storedFeed, this.entriesProcessed, this.entriesAdded);
  } else {
    // This was called after some error that skipped storage.
    // Still need to call oncomplete, but we do it without info.
    // NOTE: will callers react appropriately? how?
    this.oncomplete();
  }

};