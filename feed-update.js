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
function updateFeed(params) {

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

  if(!navigator.onLine) {
    return onerror();
  }

  // NOTE: do we fetch here or require caller to do it?
  fetchFeed({
    url: url,
    oncomplete: onFetchComplete,
    onerror: onerror,
    timeout: timeout,
    augmentEntries: augmentEntries,
    augmentImageData: augmentImageData,
    rewriteLinks: rewriteLinks
  });



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



FeedUpdate.prototype.dispatchOncomplete = function() {

  if(this.storedFeed) {
    if(this.actionType == this.CREATE) {

    }

    if(this.notify) {

    }

    this.oncomplete(this.storedFeed, this.entriesProcessed, this.entriesAdded);
  } else {
    // This was called after some error that skipped storage.
    // Still need to call oncomplete, but we do it without info.
    // NOTE: will callers react appropriately? how?
    this.oncomplete();
  }

};