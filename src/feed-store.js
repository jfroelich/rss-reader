// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

class FeedStore {

  static findByURL(connection, url, callback) {
    const transaction = connection.transaction('feed');
    const urls = transaction.objectStore('feed').index('schemeless');
    const request = urls.get(URLUtils.getSchemeless(url));
    request.onsuccess = callback;
  }

  static findById(connection, id, callback) {
    const transaction = connection.transaction('feed');
    const feeds = transaction.objectStore('feed');
    const request = feeds.get(id);
    request.onsuccess = callback;
  }

  static forEach(connection, handleFeed, sortByTitle, callback) {
    const transaction = connection.transaction('feed');
    transaction.oncomplete = callback;

    let feeds = transaction.objectStore('feed');
    if(sortByTitle) {
      feeds = feeds.index('title');
    }

    const request = feeds.openCursor();
    request.onsuccess = function(event) {
      const cursor = event.target.result;
      if(cursor) {
        handleFeed(cursor.value);
        cursor.continue();        
      }
    };
  }

  // TODO: check last modified date of the remote xml file to avoid 
  // pointless updates?
  // TODO: ensure the date is not beyond the current date?
  // TODO: maybe not modify date updated if not dirty
  static put(connection, original, feed, callback) {
    const storable = {};
    if(original) {
      storable.id = original.id;
    }
    storable.url = feed.url;
    if(original) {
      storable.schemeless = original.schemeless;
    } else {
      storable.schemeless = URLUtils.getSchemeless(storable.url);
    }

    const title = FeedStore.sanitizeValue(feed.title);
    storable.title = title || '';

    const description = FeedStore.sanitizeValue(feed.description);
    if(description) {
      storable.description = description;
    }

    const link = FeedStore.sanitizeValue(feed.link);
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

    // TODO: just use transaction.oncomplete ?
    const transaction = connection.transaction('feed', 'readwrite');
    const store = transaction.objectStore('feed');
    const request = store.put(storable);
    request.onsuccess = function(event) {
      callback();
    };
    request.onerror = function(event) {
      console.debug('Error putting feed %s', JSON.stringify(storable));
      console.dir(event);
      callback();
    };
  }

  // TODO: add _ prefix
  // TODO: sanitize html entities?
  static sanitizeValue(value) {
    if(value) {
      value = StringUtils.removeTags(value);
      value = StringUtils.stripControlCharacters(value);
      value = value.replace(/\s+/, ' ');
      value = value.trim();
      return value;
    }
  }

  static remove(connection, id, callback) {
    const transaction = connection.transaction('feed', 'readwrite');
    const store = transaction.objectStore('feed');
    const request = store.delete(id);
    request.onsuccess = callback;
  }

  // TODO: deprecate
  static unsubscribe(connection, id, callback) {
    FeedStore.remove(connection, id, function(event) {
      EntryStore.removeByFeed(connection, id, callback);
    });
  }
}
