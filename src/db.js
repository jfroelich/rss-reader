// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Database functionality
const db = {};
db.NAME = 'reader';
db.VERSION = 17;

db.EntryFlags = {
  UNREAD: 0,
  READ: 1,
  UNARCHIVED: 0,
  ARCHIVED: 1
};

db.clearEntries = function(connection) {
  'use strict';

  const run = function(connection) {
    const transaction = connection.transaction('entry', 'readwrite');
    transaction.oncomplete = onComplete;
    const store = transaction.objectStore('entry');
    store.clear();
  };

  const onOpen = function(event) {
    if(event.type !== 'success') {
      console.debug(event);
      return;
    }

    run(event.target.result);
  };

  const onComplete = function(event) {
    console.log('Cleared entry object store');
  };

  connection ? run(connection) : db.open(onOpen);
};

db.countUnreadEntries = function(connection, callback) {
  'use strict';
  const transaction = connection.transaction('entry');
  const store = transaction.objectStore('entry');
  const index = store.index('readState');
  //const range = IDBKeyRange.only(db.EntryFlags.UNREAD);
  //const request = index.count(range);
  const request = index.count(db.EntryFlags.UNREAD);
  request.onsuccess = callback;
};

db.findEntryByLink = function(connection, entryLink, callback) {
  'use strict';
  const transaction = connection.transaction('entry');
  const entries = transaction.objectStore('entry');
  const links = entries.index('link');
  const request = links.get(entryLink);
  request.onsuccess = callback;
};

db.findFeedById = function(connection, id, callback) {
  'use strict';
  const transaction = connection.transaction('feed');
  const store = transaction.objectStore('feed');
  const request = store.get(id);
  request.onsuccess = callback;
};

db.findFeedByURL = function(connection, url, callback) {
  'use strict';
  const transaction = connection.transaction('feed');
  const store = transaction.objectStore('feed');
  const index = store.index('schemeless');
  const schemeless = utils.filterURLProtocol(url);
  const request = index.get(schemeless);
  request.onsuccess = callback;
};

db.forEachFeed = function(connection, handleFeed, sortByTitle, callback) {
  'use strict';
  const transaction = connection.transaction('feed');
  transaction.oncomplete = callback;
  let store = transaction.objectStore('feed');
  if(sortByTitle) {
    store = store.index('title');
  }

  const request = store.openCursor();
  request.onsuccess = function(event) {
    const cursor = event.target.result;
    if(cursor) {
      handleFeed(cursor.value);
      cursor.continue();
    }
  };
};

db.getAllFeeds = function(connection, callback) {
  'use strict';
  const transaction = connection.transaction('feed');
  const store = transaction.objectStore('feed');
  const request = store.openCursor();
  const feeds = [];
  request.onsuccess = function(event) {
    const cursor = event.target.result;
    if(cursor) {
      feeds.push(cursor.value);
      cursor.continue();
    } else {
      callback(feeds);
    }
  };
};

db.markEntryAsRead = function(connection, entryId) {
  'use strict';
  const transaction = connection.transaction('entry', 'readwrite');
  const store = transaction.objectStore('entry');
  const request = store.openCursor(entryId);
  request.onsuccess = function onSuccess(event) {
    const request = event.target;
    const cursor = request.result;
    if(!cursor) return;
    const entry = cursor.value;
    if(!entry) return;
    if(entry.readState === db.EntryFlags.READ) return;
    entry.readState = db.EntryFlags.READ;
    entry.readDate = Date.now();
    cursor.update(entry);
    const connection = request.transaction.db;
    updateBadge(connection);
    const message = {type: 'entryRead', entry: entry};
    chrome.runtime.sendMessage(message);
  };
};

db.open = function(callback) {
  'use strict';
  const request = indexedDB.open(db.NAME, db.VERSION);
  request.onupgradeneeded = db.upgrade;
  request.onsuccess = callback;
  request.onerror = callback;
  request.onblocked = callback;
};

db.removeEntriesByFeed = function(connection, id, callback) {
  'use strict';
  const transaction = connection.transaction('entry', 'readwrite');
  transaction.oncomplete = callback;
  const store = transaction.objectStore('entry');
  const index = store.index('feed');
  const request = index.openCursor(id);
  request.onsuccess = function(event) {
    const cursor = event.target.result;
    if(cursor) {
      cursor.delete();
      cursor.continue();
    }
  };
};

db.removeFeed = function(connection, id, callback) {
  'use strict';
  const transaction = connection.transaction('feed', 'readwrite');
  const store = transaction.objectStore('feed');
  const request = store.delete(id);
  request.onsuccess = callback;
};

db.storeEntry = function(connection, entry, callback) {
  'use strict';
  const storable = {};
  if(entry.id)
    storable.id = entry.id;
  if(entry.hasOwnProperty('feedLink'))
    storable.feedLink = entry.feedLink;
  if(entry.hasOwnProperty('feedTitle'))
    storable.feedTitle = entry.feedTitle;
  if(entry.hasOwnProperty('feed'))
    storable.feed = entry.feed;
  if(entry.link)
    storable.link = entry.link;

  if(entry.hasOwnProperty('readState')) {
    storable.readState = entry.readState;
  } else {
    storable.readState = db.EntryFlags.UNREAD;
  }

  if(entry.hasOwnProperty('readDate'))
    storable.readDate = entry.readDate;
  if(entry.author)
    storable.author = entry.author;
  if(entry.title)
    storable.title = entry.title;

  if(entry.pubdate) {
    const date = new Date(entry.pubdate);
    if(utils.isValidDate(date)) {
      storable.pubdate = date.getTime();
    }
  }

  if(entry.hasOwnProperty('created')) {
    storable.created = entry.created;
  } else {
    storable.created = Date.now();
  }

  if(entry.content)
    storable.content = entry.content;

  if(entry.hasOwnProperty('archiveState')) {
    storable.archiveState = entry.archiveState;
  } else {
    storable.archiveState = db.EntryFlags.UNARCHIVED;
  }

  const transaction = connection.transaction('entry', 'readwrite');
  transaction.oncomplete = function() {
    callback();
  };
  transaction.objectStore('entry').put(storable);
};

db.storeFeed = function(connection, original, feed, callback) {
  'use strict';
  const sanitizeValue = function(value) {
    if(value) {
      value = utils.replaceHTML(value);
      value = utils.filterControlCharacters(value);
      value = value.replace(/\s+/, ' ');
      value = value.trim();
      return value;
    }
  };

  const storable = {};

  if(original) {
    storable.id = original.id;
  }

  storable.url = feed.url;

  if(feed.hasOwnProperty('type')) {
    storable.type = feed.type;
  }

  if(original) {
    storable.schemeless = original.schemeless;
  } else {
    storable.schemeless = utils.filterURLProtocol(storable.url);
  }

  const title = sanitizeValue(feed.title);
  storable.title = title || '';

  const description = sanitizeValue(feed.description);
  if(description) {
    storable.description = description;
  }

  const link = sanitizeValue(feed.link);
  if(link) {
    storable.link = link;
  }

  if(feed.date) {
    storable.date = feed.date;
  }

  if(feed.fetched) {
    storable.fetched = feed.fetched;
  }

  if(original) {
    storable.updated = Date.now();
    storable.created = original.created;
  } else {
    storable.created = Date.now();
  }

  const transaction = connection.transaction('feed', 'readwrite');
  const store = transaction.objectStore('feed');
  const request = store.put(storable);
  request.onsuccess = function(event) {
    const newId = event.target.result;
    callback(newId);
  };
  request.onerror = function(event) {
    callback();
  };
};

db.unsubscribe = function(connection, id, callback) {
  'use strict';
  db.removeFeed(connection, id, function onRemoveFeed(event) {
    db.removeEntriesByFeed(connection, id, callback);
  });
};

db.upgrade = function(event) {
  'use strict';
  console.log('Upgrading database from version %s', event.oldVersion);

  const request = event.target;
  const connection = request.result;
  let feedStore = null, entryStore = null;
  const stores = connection.objectStoreNames;

  if(stores.contains('feed')) {
    feedStore = request.transaction.objectStore('feed');
  } else {
    feedStore = connection.createObjectStore('feed', {
      keyPath: 'id',
      autoIncrement: true
    });
  }

  if(stores.contains('entry')) {
    entryStore = request.transaction.objectStore('entry');
  } else {
    entryStore = connection.createObjectStore('entry', {
      keyPath: 'id',
      autoIncrement: true
    });
  }

  const feedIndices = feedStore.indexNames;
  const entryIndices = entryStore.indexNames;

  if(!feedIndices.contains('schemeless')) {
    feedStore.createIndex('schemeless', 'schemeless', {unique: true});
  }

  if(!feedIndices.contains('title')) {
    feedStore.createIndex('title', 'title');
  }

  if(feedIndices.contains('url')) {
    feedStore.deleteIndex('url');
  }

  // Deprecated
  if(entryIndices.contains('unread')) {
    entryStore.deleteIndex('unread');
  }

  // For example, used to count the number of unread entries
  if(!entryIndices.contains('readState')) {
    entryStore.createIndex('readState', 'readState');
  }

  if(!entryIndices.contains('feed')) {
    entryStore.createIndex('feed', 'feed');
  }

  if(!entryIndices.contains('archiveState-readState')) {
    entryStore.createIndex('archiveState-readState',
      ['archiveState', 'readState']);
  }

  if(!entryIndices.contains('link')) {
    entryStore.createIndex('link', 'link', {unique: true});
  } else {
    const entryLinkIndex = entryStore.index('link');
    if(!entryLinkIndex.unique) {
      entryStore.deleteIndex('link');
      entryStore.createIndex('link', 'link', {unique: true});
    }
  }

  if(entryIndices.contains('hash')) {
    entryStore.deleteIndex('hash');
  }
};
