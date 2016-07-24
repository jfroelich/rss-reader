// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

class FeedCache {
  constructor() {
    this.name = 'reader';
    this.version = 20;
    this.log = new LoggingService();
    this.log.level = LoggingService.LEVEL_ERROR;
  }

  open(callback) {

    if(!this.name) {
      this.log.error('FeedCache: undefined database name');
      callback();
      return;
    }

    this.log.debug('FeedCache: connecting to', this.name);
    const request = indexedDB.open(this.name, this.version);
    request.addEventListener('upgradeneeded', this.upgrade.bind(this));
    request.addEventListener('success', (event) => {
      this.log.debug('FeedCache: connected to', this.name);
      callback(event.target.result);
    });
    request.addEventListener('error', (event) => {
      this.log.error(event);
      callback();
    });
    request.addEventListener('blocked', (event) => {
      this.log.error(event);
      callback();
    });
  }

  upgrade(event) {
    this.log.log('Upgrading database from version %s', event.oldVersion);

    const request = event.target;
    const connection = request.result;
    let feedStore = null, entryStore = null;
    const stores = connection.objectStoreNames;

    if(stores.contains('feed')) {
      feedStore = request.transaction.objectStore('feed');
    } else {
      feedStore = connection.createObjectStore('feed', {
        'keyPath': 'id',
        'autoIncrement': true
      });
    }

    if(stores.contains('entry')) {
      entryStore = request.transaction.objectStore('entry');
    } else {
      entryStore = connection.createObjectStore('entry', {
        'keyPath': 'id',
        'autoIncrement': true
      });
    }

    const feedIndices = feedStore.indexNames;
    const entryIndices = entryStore.indexNames;

    // Deprecated
    if(feedIndices.contains('schemeless')) {
      feedStore.deleteIndex('schemeless');
    }

    // Deprecated. Use the new urls index
    if(feedIndices.contains('url')) {
      feedStore.deleteIndex('url');
    }

    // Create a multi-entry index using the new urls property, which should
    // be an array of unique strings of normalized urls
    if(!feedIndices.contains('urls')) {
      feedStore.createIndex('urls', 'urls', {
        'multiEntry': true,
        'unique': true
      });
    }

    // TODO: deprecate this, have the caller manually sort and stop requiring
    // title, this just makes it difficult.
    if(!feedIndices.contains('title')) {
      feedStore.createIndex('title', 'title');
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

    // Deprecated. Use the urls index instead.
    if(entryIndices.contains('link')) {
      entryStore.deleteIndex('link');
    }

    // Deprecated. Use the urls index instead.
    if(entryIndices.contains('hash')) {
      entryStore.deleteIndex('hash');
    }

    if(!entryIndices.contains('urls')) {
      entryStore.createIndex('urls', 'urls', {
        'multiEntry': true,
        'unique': true
      });
    }
  }

  openUnreadUnarchivedEntryCursor(connection, callback) {
    const transaction = connection.transaction('entry');
    const entryStore = transaction.objectStore('entry');
    const index = entryStore.index('archiveState-readState');
    const keyPath = [FeedCache.EntryFlags.UNARCHIVED,
      FeedCache.EntryFlags.UNREAD];
    const request = index.openCursor(keyPath);
    request.onsuccess = callback;
    request.onerror = callback;
  }

  openEntryCursorForFeed(connection, feedId, callback) {
    const transaction = connection.transaction('entry', 'readwrite');
    const store = transaction.objectStore('entry');
    const index = store.index('feed');
    const request = index.openCursor(feedId);
    request.onsuccess = callback;
  }

  openFeedsCursor(connection, callback) {
    const transaction = connection.transaction('feed');
    const feedStore = transaction.objectStore('feed');
    const request = feedStore.openCursor();
    request.onsuccess = callback;
    request.onerror = callback;
  }

  openFeedsCursorSortedByTitle(connection, callback) {
    const transaction = connection.transaction('feed');
    const store = transaction.objectStore('feed');
    const index = store.index('title');
    const request = index.openCursor();
    request.onsuccess = callback;
  }

  findFeedById(connection, feedId, callback) {
    const transaction = connection.transaction('feed');
    const store = transaction.objectStore('feed');
    const request = store.get(feedId);
    request.onsuccess = callback;
    request.onerror = callback;
  }

  // todo: this should be exclusive to subscription-service
  deleteFeedById(connection, feedId, callback) {
    const transaction = connection.transaction('feed', 'readwrite');
    const store = transaction.objectStore('feed');
    const request = store.delete(feedId);
    request.onsuccess = callback;
  }

  getEntryById(connection, entryId, callback) {
    const transaction = connection.transaction('entry', 'readwrite');
    const store = transaction.objectStore('entry');
    const request = store.openCursor(entryId);
    request.onsuccess = callback;
    request.onerror = callback;
  }

  findEntryWithURL(connection, urlObject, callback) {
    const transaction = connection.transaction('entry');
    const entryStore = transaction.objectStore('entry');
    const urlsIndex = entryStore.index('urls');
    const request = urlsIndex.get(urlObject.href);
    request.onsuccess = callback;
    request.onerror = callback;
  }

  // TODO: entries must be sanitized fully
  addEntry(connection, entry, callback) {
    // Assume entry has url
    this.log.debug('FeedCache: adding entry',
      Entry.prototype.getURL.call(entry).href);

    const storable = {};

    // Trusted property, no need to sanitize
    if(entry.faviconURLString) {
      storable.faviconURLString = entry.faviconURLString;
    }

    // Assume sanitized previously
    if(entry.feedTitle) {
      storable.feedTitle = entry.feedTitle;
    }

    // TODO: rename the property 'feed' to 'feedId'
    // feed id is trusted, no need to sanitize
    storable.feed = entry.feed;

    // Serialize and normalize the urls
    // There is no need to do additional sanitization
    // Expect urls to be objects not strings
    storable.urls = entry.urls.map(function(url) {
      return url.href;
    });

    storable.readState = FeedCache.EntryFlags.UNREAD;
    storable.archiveState = FeedCache.EntryFlags.UNARCHIVED;

    // TODO: sanitize
    if(entry.author) {
      let authorString = entry.author;
      authorString = filterControlCharacters(authorString);
      authorString = replaceHTML(authorString);
      // TODO: do i need to use truncateHTMLString?
      // Does author ever include html entities? If so, should I strip
      // entities?
      // Are those entities encoded or decoded or is it always ambiguous?
      // TODO: if i do use truncateString, then i need to include it in
      // manifest.json
      //authorString = truncateString(authorString, MAX_AUTHOR_VALUE_LENGTH);
      storable.author = entry.author;
    }

    // TODO: enforce a maximum length using truncateHTMLString
    // TODO: condense spaces
    if(entry.title) {
      let entryTitle = entry.title;
      entryTitle = filterControlCharacters(entryTitle);
      entryTitle = replaceHTML(entryTitle, '');
      storable.title = entryTitle;
    }

    storable.dateCreated = new Date();

    if(entry.datePublished) {
      storable.datePublished = entry.datePublished;
    }

    // TODO: filter out non-printable characters other than \r\n\t
    // TODO: enforce a maximum length (using truncateHTMLString)
    if(entry.content) {
      storable.content = entry.content;
    }

    const transaction = connection.transaction('entry', 'readwrite');
    const entryStore = transaction.objectStore('entry');
    const request = entryStore.add(storable);
    request.onsuccess = callback;
    request.onerror = callback;
  }

  addFeed(connection, feed, callback) {
    feed.dateCreated = new Date();
    const transaction = connection.transaction('feed', 'readwrite');
    const feedStore = transaction.objectStore('feed');
    const request = feedStore.add(feed);
    request.onsuccess = callback;
    request.onerror = callback;
  }

  updateFeed(connection, feed, callback) {

    function sanitizeString(inputString) {
      let outputString = inputString;
      if(inputString) {
        outputString = filterControlCharacters(outputString);
        outputString = replaceHTML(outputString, '');
        outputString = outputString.replace(/\s+/, ' ');
        outputString = outputString.trim();
      }
      return outputString;
    }

    const storable = {};
    storable.id = feed.id;

    if(feed.type) {
      storable.type = feed.type;
    }

    // clone
    storable.urls = [...feed.urls];

    storable.title = sanitizeString(feed.title) || '';

    if(feed.description) {
      storable.description = sanitizeString(feed.description);
    }

    if(feed.link) {
      storable.link = feed.link;
    }

    if(feed.faviconURLString) {
      storable.faviconURLString = feed.faviconURLString;
    }

    storable.datePublished = feed.datePublished;
    storable.dateCreated = feed.dateCreated || new Date();
    storable.dateLastModified = feed.dateLastModified;
    storable.dateUpdated = new Date();

    const transaction = connection.transaction('feed', 'readwrite');
    const store = transaction.objectStore('feed');
    const request = store.put(storable);

    request.onsuccess = function(event) {
      callback('success', storable);
    };

    request.onerror = function(event) {
      this.log.debug('FeedCache: update feed error', event);
      callback('error', storable);
    }.bind(this);
  }
}

FeedCache.EntryFlags = {
  UNREAD: 0,
  READ: 1,
  UNARCHIVED: 0,
  ARCHIVED: 1
};
