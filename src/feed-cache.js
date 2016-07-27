// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

class FeedCache {

  constructor() {
    this.name = 'reader';
    this.version = 20;
  }

  open(callback) {
    console.assert(this.name, 'Undefined database name');
    console.assert(this.version, 'Invalid database version %s', this.version);


    const request = indexedDB.open(this.name, this.version);
    request.addEventListener('upgradeneeded', this.upgrade.bind(this));
    request.addEventListener('success', (event) => {
      console.debug('Connected to database', this.name);
      callback(event.target.result);
    });
    request.addEventListener('error', function(event) {
      console.error(event);
      callback();
    });
    request.addEventListener('blocked', function(event) {
      console.warn(event);
      callback();
    });
  }

  upgrade(event) {
    console.log('Upgrading database from version', event.oldVersion);

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
    console.debug('Loading unread unarchived entries');
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
    console.debug('Loading entries with feed id', feedId);
    const transaction = connection.transaction('entry', 'readwrite');
    const store = transaction.objectStore('entry');
    const index = store.index('feed');
    const request = index.openCursor(feedId);
    request.onsuccess = callback;
  }

  openFeedsCursor(connection, callback) {
    console.debug('Opening feeds cursor');
    const transaction = connection.transaction('feed');
    const feedStore = transaction.objectStore('feed');
    const request = feedStore.openCursor();
    request.onsuccess = callback;
    request.onerror = callback;
  }

  openFeedsCursorSortedByTitle(connection, callback) {
    console.debug('Opening feeds cursor sorted by title');
    const transaction = connection.transaction('feed');
    const store = transaction.objectStore('feed');
    const index = store.index('title');
    const request = index.openCursor();
    request.onsuccess = callback;
  }

  findFeedById(connection, feedId, callback) {
    console.debug('Finding feed with id', feedId);
    const transaction = connection.transaction('feed');
    const store = transaction.objectStore('feed');
    const request = store.get(feedId);
    request.onsuccess = callback;
    request.onerror = callback;
  }

  deleteFeedById(connection, feedId, callback) {
    console.debug('Deleting feed with id', feedId);
    const transaction = connection.transaction('feed', 'readwrite');
    const store = transaction.objectStore('feed');
    const request = store.delete(feedId);
    request.onsuccess = callback;
  }

  findEntryById(connection, entryId, callback) {
    console.debug('Finding entry with id', entryId);
    const transaction = connection.transaction('entry', 'readwrite');
    const store = transaction.objectStore('entry');
    const request = store.openCursor(entryId);
    request.onsuccess = callback;
    request.onerror = callback;
  }

  findEntryWithURL(connection, urlObject, callback) {
    console.debug('Finding entry with url', urlObject.href);
    const transaction = connection.transaction('entry');
    const entryStore = transaction.objectStore('entry');
    const urlsIndex = entryStore.index('urls');
    const request = urlsIndex.get(urlObject.href);
    request.onsuccess = callback;
    request.onerror = callback;
  }

  markEntryAsRead(entryId, callback) {
    console.debug('Marking entry %s as read', entryId);
    this.open(onOpenDatabase.bind(this));

    function onOpenDatabase(connection) {
      if(!connection) {
        if(callback) {
          callback({
            'type': 'connectionerror',
            'entryId': entryId
          });
        }
        return;
      }

      this.findEntryById(connection, entryId, onOpenCursor.bind(this));
    }

    function onOpenCursor(event) {
      const cursor = event.target.result;
      if(!cursor) {
        console.error('No entry found for id %i to mark as read', entryId);
        if(callback) {
          callback({
            'type': 'notfounderror',
            'entryId': entryId
          });
        }
        return;
      }

      const entry = cursor.value;
      if(entry.readState === FeedCache.EntryFlags.READ) {
        console.error('Attempted to remark read entry with id %i as read',
          entryId);
        if(callback) {
          callback({
            'type': 'alreadyreaderror',
            'entryId': entryId
          });
        }
        return;
      }

      entry.readState = FeedCache.EntryFlags.READ;
      const dateNow = new Date();
      entry.dateRead = dateNow;
      entry.dateUpdated = dateNow;
      cursor.update(entry);

      // Because BadgeUpdateService relies on FeedCache we have a circular
      // dependency, so I cannot create an instance of BadgeUpdateService in
      // FeedCache's constructor. So create a new instance here every time.
      const badgeUpdateService = new BadgeUpdateService();
      badgeUpdateService.updateCount();

      console.log('Requested entry with id %i be marked as read', entryId);

      if(callback) {
        callback({
          'type': 'success',
          'entryId': entryId
        });
      }
    }
  }

  // TODO: entries must be sanitized fully
  addEntry(connection, entry, callback) {

    const terminalEntryURL = Entry.prototype.getURL.call(entry);
    console.assert(terminalEntryURL, 'Entry missing url %O', entry);
    console.debug('Adding entry', terminalEntryURL.href);

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

    // TODO: sanitize fully
    if(entry.author) {
      let authorString = entry.author;
      authorString = filterControlCharacters(authorString);
      authorString = replaceHTML(authorString, '');
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
    // TODO: condense spaces?
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
    // TODO: enforce a maximum storable length (using truncateHTMLString)
    if(entry.content) {
      storable.content = entry.content;
    }

    const transaction = connection.transaction('entry', 'readwrite');
    const entryStore = transaction.objectStore('entry');
    const request = entryStore.add(storable);
    request.onsuccess = callback;
    request.onerror = callback;
  }

  // TODO: this should be sanitizing the feed's fields, it should not be
  // the caller's responsibility.
  // look at what i did for updateFeed and mirror that behavior
  // TODO: this should be responsible for creating the serialized storable
  // object. The caller may have set other fields on the input object that
  // we do not want to store, or may pass in a non-serialized object.
  // TODO: when sanitizing, consider max length of each field and the
  // behavior when exceeded
  addFeed(connection, feed, callback) {
    console.debug('Storing new feed', feed);
    feed.dateCreated = new Date();
    const transaction = connection.transaction('feed', 'readwrite');
    const feedStore = transaction.objectStore('feed');
    const request = feedStore.add(feed);
    request.onsuccess = callback;
    request.onerror = callback;
  }

  sanitizeString(inputString) {
    if(inputString) {
      let outputString = null;
      outputString = filterControlCharacters(inputString);
      outputString = replaceHTML(outputString, '');
      outputString = outputString.replace(/\s+/, ' ');
      outputString = outputString.trim();
      return outputString;
    }
  }

  sanitizeFeed(inputFeed) {
    // Copy to maintain all the fields and also purity/idempotency
    const cleanFeed = Object.assign({}, inputFeed);
    if(cleanFeed.title) {
      cleanFeed.title = this.sanitizeString(cleanFeed.title);
    }

    if(cleanFeed.description) {
      cleanFeed.description = this.sanitizeString(cleanFeed.description);
    }

    return cleanFeed;
  }

  updateFeed(connection, feed, callback) {
    console.debug('Updating feed in storage', feed);
    let storableFeed = Feed.prototype.serialize.call(feed);
    storableFeed = this.sanitizeFeed(storableFeed);
    storableFeed.dateUpdated = new Date();

    const transaction = connection.transaction('feed', 'readwrite');
    const store = transaction.objectStore('feed');
    const request = store.put(storableFeed);

    request.onsuccess = function(event) {
      console.debug('Updated feed', Feed.prototype.getURL.call(storableFeed));
      callback('success', storableFeed);
    };

    request.onerror = function(event) {
      console.error('Error updating feed', event);
      callback('error', storableFeed);
    };
  }
}

FeedCache.EntryFlags = {
  UNREAD: 0,
  READ: 1,
  UNARCHIVED: 0,
  ARCHIVED: 1
};
