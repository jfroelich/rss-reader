// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

class BadgeUpdateService {

  constructor() {
    this.cache = new FeedCache();
  }

  updateCount(callback) {
    console.debug('Updating extension badge unread count');
    this.cache.open(this.onOpenCache.bind(this, callback));
  }

  onOpenCache(callback, connection) {
    if(connection) {
      console.debug('Counting unread entries');
      // TODO: actually I think this belongs in feedcache
      const transaction = connection.transaction('entry');
      const store = transaction.objectStore('entry');
      const index = store.index('readState');
      const request = index.count(Entry.FLAGS.UNREAD);
      const boundOnRequest = this.onCountUnreadEntries.bind(this, callback);
      request.addEventListener('success', boundOnRequest);
      request.addEventListener('error', boundOnRequest);
    } else {
      chrome.browserAction.setBadgeText({'text': '?'});
      if(callback) {
        callback();
      }
    }
  }

  onCountUnreadEntries(callback, event) {
    if(event.type === 'success') {
      const count = event.target.result;
      console.debug('Setting badge text', count);
      chrome.browserAction.setBadgeText({'text': '' + count});
    } else {
      console.error('Error counting unread entries', event);
      chrome.browserAction.setBadgeText({'text': '?'});
    }

    event.target.transaction.db.close();
    if(callback) {
      callback();
    }
  }
}
