// Storage-related functions

var model = {};

model.DATABASE_NAME = 'reader';
model.DATABASE_VERSION = 1;

model.READ_STATE = {'READ': 1, 'UNREAD': 2};

// Wraps indexedDB.open to apply common callbacks to all connections
model.connect = function(callback) {
  var request = indexedDB.open(this.DATABASE_NAME, this.DATABASE_VERSION);

  request.onerror = request.onblocked = console.error;
  request.onupgradeneeded = this.upgradeDatabase;

  request.onsuccess = function(event) {
    callback(event.target.result);
  };

  return 'Connecting to ' + this.DATABASE_NAME + ' version ' +
    this.DATABASE_VERSION;
}

model.upgradeDatabase = function(event) {
  console.log('Upgrading database, old version %s', event.oldVersion);
  var db = event.target.result;
  var entryStore, feedStore;

  feedStore = db.createObjectStore('feed', {keyPath:'id',autoIncrement:true});
  entryStore = db.createObjectStore('entry', {keyPath: 'id'});

  // For checking if already subscribed
  feedStore.createIndex('url','url',{unique:true});

  // For quickly counting unread
  entryStore.createIndex('read','read');

  // For quickly deleting entries when unsubscribing
  entryStore.createIndex('feed','feed');

  // For iterating unread by date ascending
  entryStore.createIndex('read-fetched',['read','fetched']);
};

model.countUnread = function(db, callback) {
  var tx = db.transaction('entry');
  var index = tx.objectStore('entry').index('read');
  var range = IDBKeyRange.only(this.READ_STATE.UNREAD);
  var request = index.count(range);
  request.onsuccess = function(event) {
    callback(event.target.result);
  };
};

model.countFeeds = function(db, cb) {
  db.transaction('feed').objectStore('feed').count().onsuccess = function(event) {
    cb(event.target.result);
  };
};

model.forEachFeed = function(db, callback, oncomplete) {
  var tx = db.transaction('feed');
  
  // WARNING: this could complete before the callback on 
  // the last feed completes, leading to unexpected behavior.
  tx.oncomplete = oncomplete;

  var store = tx.objectStore('feed');
  var request = store.openCursor();
  request.onsuccess = function(event) {
    var cursor = event.target.result;
    if(cursor) {
      callback(cursor.value);
      cursor.continue();
    }
  };
};

model.isSubscribed = function(db, url, callback) {
  var index = db.transaction('feed').objectStore('feed').index('url');
  index.get(url).onsuccess = function(event) {
    callback(event.target.result);
  };
};

model.generateEntryId = function(entry) {
  var seed = entry.link || entry.title || entry.content;
  if(seed) {
    var hash = hashCode(seed.split(''));
    return decToHex(hash);
  }
};

model.insertOrUpdateFeed = function(db, feed, callback) {
  var store = db.transaction('feed','readwrite').objectStore('feed');
  
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

  var entryCursor = 
    entries.index('feed').openKeyCursor(IDBKeyRange.only(feedId));
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

// Add an entry. If the entry already exists, a uniqueness constraint
// violation will occur and request.onerror is triggered instead of
// request.onsuccess. This is why we use a separate tx for each request
// when adding a batch of entries.

model.addEntry = function(db, entry, onSuccess, onError) {
  var tx = db.transaction('entry','readwrite');
  var store = tx.objectStore('entry');
  var request = store.add(entry);
  request.onsuccess = onSuccess;
  request.onerror = onError;
};

// Marks entries with the given ids as read and also archives 
// some of each entry's properties
model.markRead = function(db, ids, callback) {

  var tx = db.transaction('entry','readwrite');  
  tx.oncomplete =  callback;  
  var store = tx.objectStore('entry');
  var onGetEntry = function(event) {
    var entry = event.target.result;
    if(entry) {
      store.put({
        'id': entry.id,
        'read': model.READ_STATE.READ,
        'feed': entry.feed
      });
    }
  };

  each(ids, function(id) {
    store.get(id).onsuccess = onGetEntry;
  });
};

model.markEntryRead = function(db, entryId, callback) {
  var tx = db.transaction('entry','readwrite');
  tx.oncomplete = callback;
  var store = tx.objectStore('entry');
  
  store.get(entryId).onsuccess = function(event) {
    var entry = event.target.result;
    if(entry) {
      store.put({
        'id': entry.id,
        'read': model.READ_STATE.READ,
        'feed': entry.feed
      });
    }
  };
};


// Iterate over some entries, sending each entry to callback
model.forEachEntry = function(db, params, callback, onComplete) {

  var fromDate = params.fromDate || 0;
  var endDate = (new Date(2030,0)).getTime();
  var limit = params.limit;
  var unread = model.READ_STATE.UNREAD;
  var tx = db.transaction('entry');
  tx.oncomplete = onComplete;
  var index = tx.objectStore('entry').index('read-fetched');
  var range;
  var counter = 0;

  if(fromDate) {
    range = IDBKeyRange.bound([unread, fromDate],[unread, endDate]);
  } else {
    // Load any unread articles
    range = IDBKeyRange.bound([unread, 0],[unread, endDate]);
  }

  var request = index.openCursor(range);

  request.onsuccess = function(event) {
    var cursor = event.target.result;
    if(cursor) {
      callback(cursor.value);
      if(++counter < limit) {
        cursor.continue();
      }
    }
  };
};