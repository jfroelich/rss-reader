
// TODO: consider breaking this up into separate things
// instead of just cramming all of this into the same thing.

// Storage-related functions

var model = {};

model.DATABASE_NAME = 'reader';
model.DATABASE_VERSION = 7;

// If an entry's unread property has this value then it is unread. 
// We are using an integer flag because indexedDB does not support 
// indices on booleans.
model.UNREAD = 1;

// Connect to indexedDB
model.connect = function(callback) {
  var request = indexedDB.open(model.DATABASE_NAME, model.DATABASE_VERSION);
  request.onerror = console.error;
  request.onblocked = console.error;
  request.onupgradeneeded = this.onupgradeneeded_;
  request.onsuccess = function(event) {
    callback(event.target.result);
  };
};


model.onupgradeneeded_ = function(event) {
  var db = event.target.result;

  // TODO: this branch needs testing again
  // - is the initial version 0 or 1????

  if(event.oldVersion == 0) {

    //console.log('Setting up database for first time');
    
    //console.log('Creating feed store');
    var feedStore = db.createObjectStore('feed', {keyPath:'id',autoIncrement:true});
    // For checking if already subscribed
    feedStore.createIndex('url','url',{unique:true});

    // For loading feeds in alphabetical order
    feedStore.createIndex('title','title');

    //console.log('Create entry store');
    var entryStore = db.createObjectStore('entry', {keyPath:'id',autoIncrement:true});

    // For quickly counting unread 
    // and for iterating over unread in id order
    entryStore.createIndex('unread','unread');

    // For quickly deleting entries when unsubscribing
    entryStore.createIndex('feed','feed');

    // For quickly checking whether a similar entry exists
    entryStore.createIndex('hash','hash');

  } else if(event.oldVersion == 6) {
    //console.log('Upgrading database from %s', event.oldVersion);
    var tx = event.currentTarget.transaction;
    
    // Add the title index
    tx.objectStore('feed').createIndex('title','title');
  } else {
    console.error('Unhandled database upgrade, old version was %s', event.oldVersion);
  }
};


model.RANGE_ONLY_UNREAD_ = IDBKeyRange.only(model.UNREAD);

model.countUnread = function(db, callback) {
  db.transaction('entry').objectStore('entry').index('unread').count(
    this.RANGE_ONLY_UNREAD_).onsuccess = function(event) {
    callback(event.target.result);
  };
};

model.countFeeds = function(db, callback) {
  db.transaction('feed').objectStore('feed').count().onsuccess = function(event) {
    callback(event.target.result);
  };
};

model.forEachFeed = function(db, callback, oncomplete, sortByTitle) {
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

// TODO: rename this to something like getFeedByURL
model.isSubscribed = function(db, url, callback) {
  var index = db.transaction('feed').objectStore('feed').index('url');
  index.get(url).onsuccess = function(event) {
    callback(event.target.result);
  };
};

// TODO: not sure if this really belongs here
// NOTE: requires hashing.hashCode
model.generateEntryHash = function(entry) {
  var seed = entry.link || entry.title || entry.content;
  if(seed) {
    return hashing.hashCode(seed.split(''));
  }
};


model.insertOrUpdateFeed = function(db, feed, callback) {
  var store = db.transaction('feed','readwrite').objectStore('feed');
  
  // If id is defined then we are updating. Otherwise we are creating.
  
  if(feed.id) {
    store.put(feed).onsuccess = function(event) {
      callback(feed);
    };
  } else {
    store.add(feed).onsuccess = function(event) {
      feed.id = event.target.result;
      callback(feed);
    };
  }
};

// Remove a feed and its entries
model.unsubscribe = function(db, feedId, callback) {
  var tx = db.transaction(['entry','feed'],'readwrite');
  var entries = tx.objectStore('entry');
  var feeds = tx.objectStore('feed');

  var entryCursor = entries.index('feed').openKeyCursor(IDBKeyRange.only(feedId));
  entryCursor.onsuccess = function(event) {
    var cursor = event.target.result;
    if(cursor) {
      entries.delete(cursor.primaryKey);
      cursor.continue();
    }
  };

  feeds.delete(feedId);
  tx.oncomplete = callback;
};

model.addEntry = function(store, entry, onSuccess, onError) {
  
  // Fails if an entry with the same id exists
  var request = store.add(entry);
  request.onsuccess = onSuccess;
  request.onerror = onError;
};

model.containsEntryHash = function(store, hash, callback) {
  store.index('hash').get(IDBKeyRange.only(hash)).onsuccess = function(event) {
    callback(event.target.result);
  }
}

// Marks entries as read and deletes unused properties
// TODO: could use index('unread').get instead of store.get
// TODO: could maybe use cursor.update????
// NOTE: requires collections.each
model.markRead = function(db, ids, callback) {

  var tx = db.transaction('entry','readwrite');  
  tx.oncomplete =  callback;  
  var store = tx.objectStore('entry');
  var onGetEntry = function(event) {
    var entry = event.target.result;
    if(entry) {
      var request = store.put({
        'id': entry.id,
        'feed': entry.feed,
        'hash' : entry.hash
      });
    }
  };

  collections.each(ids, function(id) {
    store.get(parseInt(id)).onsuccess = onGetEntry;
  });
};

// TODO: could use index('unread').get instead of store.get
// TODO: could maybe use cursor.update?
model.markEntryRead = function(db, entryId, callback) {
  var tx = db.transaction('entry','readwrite');
  tx.oncomplete = callback;
  var store = tx.objectStore('entry');
  
  store.get(entryId).onsuccess = function(event) {
    var entry = event.target.result;
    if(entry) {
      
      // We are only keeping these values since we 
      // no longer expose read entries.
      // id so we overwrite the property entry.
      // feed so we can delete by feed when unsubsribing
      // hash so we can check for loosely defined "existence".
      
      store.put({
        'id': entry.id,
        'feed': entry.feed,
        'hash': entry.hash
      });
    }
  };
};

// Iterate over all unread entries with an id greater than the minimumId
// TODO: rename this more appropriately
model.forEachEntry = function(db, params, callback, onComplete) {
  var counter = 0, offset = params.offset || 0, 
    limit = parseInt(params.limit) || 0, 
    unlimited = limit <= 0, 
    advanced = false;

  if(!callback) {
    return;
  }

  var tx = db.transaction('entry');
  tx.oncomplete = onComplete;
  tx.objectStore('entry').index('unread').openCursor().onsuccess = function(event) {
    var cursor = event.target.result;
    if(!cursor) return;
    if(offset > 0 && !advanced) {
      advanced = true;
      cursor.advance(offset);
      return;
    }

    callback(cursor.value);
    if(unlimited || (++counter < limit)) {
      cursor.continue();
    }
  };
};