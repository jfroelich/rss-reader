
// props: timeout, db, notify, fetch, onerror, oncomplete

var FeedUpdate = function() {
  this.CREATE = 1;
  this.UPDATE = 2;
};

FeedUpdate.prototype.add = FeedUpdate.prototype.create = function(url) {
  this.url = util.stripControls(url.trim());
  this.actionType = this.CREATE;
  this.insertOrUpdate();
};

FeedUpdate.prototype.update = function(id, url) {
  this.feedId = id;
  this.url = util.stripControls(url.trim());
  this.actionType = this.UPDATE;
  this.insertOrUpdate();
};


////////////////////////////////////////////////////////////////////
// Private methods (should not call but atm I am not bothering to 
// protect with an IEAF)

FeedUpdate.prototype.insertOrUpdate = function() {

  this.onerror = this.onerror || util.noop;

  if(this.actionType == this.CREATE) {
    
    // Ensure the url is valid
    if(!URI.isValidString(this.url)) {
      this.onerror({type:'invalidurl',url:this.url});
      return this.callOncomplete();
    }

    // If creating, start by checking that we are not 
    // subscribed, and then start fetching.
    
    if(this.db) {
      this.fetchFeedIfNotExists();
    } else {
      var self = this;
      model.connect(function(db) {
        self.db = db;
        self.fetchFeedIfNotExists();
      });
    }
  } else if(this.actionType == this.UPDATE) {

    // If updating, go straight to fetching

    self.fetchFeed();
  }
};

FeedUpdate.prototype.fetchFeedIfNotExists = function() {
  var schemelessURL = util.getSchemelessURL(this.url);
  var schemelessIndex = this.db.transaction('feed').objectStore('feed').index('schemeless');
  var self = this;
  schemelessIndex.get(schemelessURL).onsuccess = function(event) {
    if(event.target.result) {
      self.onerror({type:'exists',url:self.url,feed:event.target.result});
      self.callOncomplete();
    } else {
      self.fetchFeed();
    }
  };
};

FeedUpdate.prototype.fetchFeed = function() {
  if(this.fetch && navigator.onLine) {
    
    var request = new FeedHttpRequest();
    request.timeout = this.timeout;
    request.onerror = this.onerror;
    request.oncomplete = this.onFeedLoaded.bind(this);
    request.send(this.url);
    return;
  }
  
  // If we are not fetching or not online 
  
  if(this.actionType == this.CREATE) {
    var self = this;
    
    // Ensure database connection
    model.connect(function(db) {
      self.db = db;

      // TODO: insert feed? maybe we want mixed 'insertorupdateFetchedFeed'
      
      // Since we are not fetching, simulate a fetchedFeed object
      self.fetchedFeed = {url:self.url};
      
      self.insertFeed();
    });
  } else if(this.actionType == this.UPDATE) {

    // Since we are not updating, simulate an updatedFeed object
    // self.storedFeed = {id:0,url:self.url};
    // We are done.
    this.callOncomplete();
  }
};

FeedUpdate.prototype.onFeedLoaded = function(feed) {
  if(!feed) {
    // A problem occurred while fetching. The error was 
    // dispatched by the onerror callback from FeedHttpRequest
    // so we are done
    this.callOncomplete();
    return;
  }

  // Stash the fetchedFeed object
  this.fetchedFeed = feed;

  // Set the date fetched to now.
  this.fetchedFeed.fetched = Date.now();
  
  // Ensure database connection
  var self = this;
  model.connect(function(db) {
    self.db = db;
    
    if(self.actionType == self.CREATE) {
      self.insertFeed();
    } else if(self.actionType = self.UPDATE) {
      self.updateFeed();
    }
  });
};

FeedUpdate.prototype.insertFeed = function() {
  console.log('Inserting %s', this.url);

  this.fetchedFeed.url = this.url;
  this.storedFeed = this.getStorableFeed(this.fetchedFeed);
  this.storedFeed.created = Date.now();

  var self = this;  
  var feedStore = this.db.transaction('feed','readwrite').objectStore('feed');

  feedStore.add(storedFeed).onsuccess = function(event) {
    
    console.log('Inserted %s, new id is %s', self.url, this.result);
    
    self.storedFeed.id = this.result;
    
    if(self.fetchedFeed && self.fetchedFeed.fetched) {
      self.addEntries();
    } else {
      self.callOncomplete();
    }
  };  
};

FeedUpdate.prototype.updateFeed = function() {
  this.fetchedFeed.id = this.feedId;
  this.fetchedFeed.url = this.url;
  this.storedFeed = this.getStorableFeed(this.fetchedFeed);
  var self = this;
  
  var tx = this.db.transaction('feed','readwrite');
  var feedStore = tx.objectStore('feed'); 
  feedStore.get(this.feedId).onsuccess = function(event) {
    var existingFeed = this.result;

    if(!existingFeed) {
      self.onerror({type:'feednotfound',feedId: self.feedId});
      return self.callOncomplete();
    }

    if(storedFeed.title) existingFeed.title = storedFeed.title;
    if(storedFeed.description)
      existingFeed.description = storedFeed.description;
    if(storedFeed.date) existingFeed.date = storedFeed.date;
    if(storedFeed.link) existingFeed.link = storedFeed.link;    
    if(storedFeed.fetched) existingFeed.fetched = storedFeed.fetchedFeed;

    existingFeed.updated = Date.now();
    if(!existingFeed.created) existingFeed.created = existingFeed.updated;
    feedStore.put(existingFeed).onsuccess = self.addEntries;
  };
};

FeedUpdate.prototype.getStorableFeed = function(input) {
  var output = {};
  
  if(input.id) output.id = input.id;
  
  output.url = input.url;
  output.schemeless = util.getSchemelessURL(input.url);

  if(input.title) {
    output.title = util.stripTags(util.stripControls(input.title));
  } else {
    output.title = util.stripTags(util.stripControls(input.url));
  }

  if(input.description) {
    output.description = util.stripTags(util.stripControls(input.description));
  }

  if(input.link) {
    output.link = util.stripControls(input.link);
  }

  if(input.date) {
    var d = util.parseDate(util.stripControls(input.date));
    if(d) output.date = d.getTime();  
  }

  if(input.fetched) output.fetched = input.fetched; 
  if(input.created) output.created = input.created;  
  if(input.updated) output.updated = input.updated;
  return output;  
};

FeedUpdate.prototype.addEntries = function() {
  
  if(!this.fetchedFeed || !this.fetchedFeed.entries || !this.fetchedFeed.entries.length) {
    return this.callOncomplete();
  }
  
  this.entriesProcessed = 0;
  this.entriesAdded = 0;
  
  var self = this;

  var onUpdateComplete = function() {
    self.entriesProcessed++;
    if(self.entriesProcessed >= self.fetchedFeed.entries.length) {
      self.callOncomplete();
    }
  };
  
  var onUpdateSuccess = function() {
    self.entriesAdded++;
    onUpdateComplete();
  };
  
  var onUpdateError = function() {
    onUpdateComplete();
  };  
  
  util.each(this.fetchedFeed.entries, function(fetchedEntry) {
    
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
      
      var pubdate = util.parseDate(fetchedEntry.pubdate);
      if(pubdate) storableEntry.pubdate = pubdate.getTime();
      else if(storedFeed.date) storableEntry.pubdate = self.storedFeed.date;
      
      storableEntry.created = Date.now();
      
      if(fetchedEntry.content) {
        // We are no longer sanitizing before storing. We are sanitizing, 
        // trimming, and rewriting/resolving urls in real time on render.
        storableEntry.content = fetchedEntry.content;
      }

      var insertRequest = entryStore.add(storableEntry);
      insertRequest.onerror = onUpdateError;
      insertRequest.onsuccess = onUpdateSuccess;
    };
  });
};

FeedUpdate.prototype.generateEntryHash = function(entry) {
  var seed = entry.link || entry.title || entry.content;
  if(seed) return util.generateHashCode(seed.split(''));
};




FeedUpdate.prototype.callOncomplete = function() {
  
  if(this.actionType == this.CREATE) {
    chrome.runtime.sendMessage({type:'subscribe',feed:this.storedFeed});
  }
  
  if(this.notify) {
    util.notify('Subscribed to '+this.storedFeed.title+'. Found '+this.entriesAdded+' new articles.');
  }
  
  this.oncomplete(this.storedFeed, this.entriesProcessed, this.entriesAdded);
};