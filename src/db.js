// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// indexedDB functionality

// TODO: just store scheme and schemeless props as parts of a url object
// property? remember that indexeddb can access deeper props using '.' in
// keypaths, right?
// TODO: store urls as URL objects?

function db_open(callback) {
  'use strict';

  const DB_NAME = 'reader';
  const DB_VERSION = 17;

  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = db_upgrade;
  request.onsuccess = callback;
  request.onerror = callback;
  request.onblocked = callback;
}

function db_clear_entries(connection) {
  'use strict';

  if(connection) {
    clear_entries(connection);
  } else {
    db_open(on_open);
  }

  function on_open(event) {
    if(event.type !== 'success') {
      console.debug(event);
      return;
    }

    const connection = event.target.result;
    clear_entries(connection);
  }

  function clear_entries(connection) {
    const transaction = connection.transaction('entry', 'readwrite');
    transaction.oncomplete = on_complete;
    const store = transaction.objectStore('entry');
    store.clear();
  }

  function on_complete(event) {
    console.log('Cleared entry object store');
  }
}

function db_count_unread_entries(connection, callback) {
  'use strict';
  const transaction = connection.transaction('entry');
  const store = transaction.objectStore('entry');
  const index = store.index('readState');
  const request = index.count(ENTRY_FLAGS.UNREAD);
  request.onsuccess = callback;
}

function db_find_entry_by_link(connection, entryLink, callback) {
  'use strict';
  const transaction = connection.transaction('entry');
  const entries = transaction.objectStore('entry');
  const links = entries.index('link');
  const request = links.get(entryLink);
  request.onsuccess = callback;
}

function db_find_feed_by_id(connection, id, callback) {
  'use strict';
  const transaction = connection.transaction('feed');
  const store = transaction.objectStore('feed');
  const request = store.get(id);
  request.onsuccess = callback;
}

function db_find_feed_by_url(connection, url, callback) {
  'use strict';
  const transaction = connection.transaction('feed');
  const store = transaction.objectStore('feed');
  const index = store.index('schemeless');
  const schemeless = url_filter_protocol(url);
  const request = index.get(schemeless);
  request.onsuccess = callback;
}

function db_for_each_feed(connection, handleFeed, sortByTitle, callback) {
  'use strict';

  function on_success(event) {
    const cursor = event.target.result;
    if(cursor) {
      handleFeed(cursor.value);
      cursor.continue();
    }
  }

  const transaction = connection.transaction('feed');
  transaction.oncomplete = callback;
  let store = transaction.objectStore('feed');
  if(sortByTitle) {
    store = store.index('title');
  }

  const request = store.openCursor();
  request.onsuccess = on_success;
}

function db_get_all_feeds(connection, callback) {
  'use strict';

  function on_success(event) {
    const cursor = event.target.result;
    if(cursor) {
      feeds.push(cursor.value);
      cursor.continue();
    } else {
      callback(feeds);
    }
  }

  const transaction = connection.transaction('feed');
  const store = transaction.objectStore('feed');
  const request = store.openCursor();
  const feeds = [];
  request.onsuccess = on_success;
}

// TODO: should this also update a dateUpdated property of the entry?
// TODO: should something else be responsible for the badge update stuff, like
// a decoupled listener?
function db_mark_entry_as_read(connection, entryId) {
  'use strict';

  function on_success(event) {
    const request = event.target;
    const cursor = request.result;

    if(!cursor) {
      return;
    }

    const entry = cursor.value;
    if(!entry) {
      return;
    }

    if(entry.readState === ENTRY_FLAGS.READ) {
      return;
    }
    entry.readState = ENTRY_FLAGS.READ;
    entry.readDate = Date.now();
    cursor.update(entry);

    const connection = request.transaction.db;
    badge_update_count(connection);

    const message = {type: 'entryRead', entry: entry};
    chrome.runtime.sendMessage(message);
  }

  const transaction = connection.transaction('entry', 'readwrite');
  const store = transaction.objectStore('entry');
  const request = store.openCursor(entryId);
  request.onsuccess = on_success;
}

// TODO: maybe make a separate private helper function that prepares the
// entry for storage, as opposed to doing it all in a single function
// TODO: maybe the prepareEntryForStorage function should be its own global
// function and the caller has the responsibility of preparation and then the
// only concern of this function is to do an update?
// TODO: i really just don't like the fact I have to wrap the callback
// function, so think about this would have to be changed to not do that
// TODO: make sure pubdate has a consistent value. I am using
// date.getTime here, but I am not sure I am using the same
// or similar every where else. Like in poll denormalize

function db_store_entry(connection, entry, callback) {
  'use strict';

  const storable = {};
  if(entry.id) {
    storable.id = entry.id;
  }
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
    storable.readState = ENTRY_FLAGS.UNREAD;
  }

  if(entry.hasOwnProperty('readDate'))
    storable.readDate = entry.readDate;
  if(entry.author)
    storable.author = entry.author;
  if(entry.title)
    storable.title = entry.title;

  if(entry.pubdate) {
    const date = new Date(entry.pubdate);
    if(date_is_valid(date)) {
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
    storable.archiveState = ENTRY_FLAGS.UNARCHIVED;
  }

  // TODO: deprecate async in calling context so that this can just call
  // callback directly
  function on_complete() {
    callback();
  }

  const transaction = connection.transaction('entry', 'readwrite');
  transaction.oncomplete = on_complete;
  transaction.objectStore('entry').put(storable);
}

function db_sanitize_value(value) {
  if(value) {
    value = html_replace(value, '');
    value = string_filter_controls(value);
    value = value.replace(/\s+/, ' ');
    value = value.trim();
    return value;
  }
}


// TODO: check last modified date of the remote xml file to avoid
// pointless updates?
// TODO: ensure the date is not beyond the current date?
// TODO: maybe not modify date updated if not dirty
// TODO: sanitize html entities?
function db_store_feed(connection, original, feed, callback) {
  'use strict';

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
    storable.schemeless = url_filter_protocol(storable.url);
  }

  const title = db_sanitize_value(feed.title);
  storable.title = title || '';

  const description = db_sanitize_value(feed.description);
  if(description) {
    storable.description = description;
  }

  const link = db_sanitize_value(feed.link);
  if(link) {
    storable.link = link;
  }

  if(feed.date) {
    storable.date = feed.date;
  }

  if(feed.fetchDate) {
    storable.fetchDate = feed.fetchDate;
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
  request.onsuccess = function onSuccess(event) {
    const newId = event.target.result;
    callback(newId);
  };
  request.onerror = function onError(event) {
    callback();
  };
}

function db_upgrade(event) {
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
}
