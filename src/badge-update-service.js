// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

class BadgeUpdateService {
  constructor() {
    this.log = new LoggingService();
    this.log.level = LoggingService.LEVEL_LOG;
    this.cache = new FeedCache();
  }

  updateCount(callback) {
    this.log.debug('BadgeUpdateService: updating count');
    this.cache.open(this.onOpenCache.bind(this, callback));
  }

  onOpenCache(callback, connection) {
    if(connection) {
      this.log.debug('BadgeUpdateService: counting unread entries');
      const transaction = connection.transaction('entry');
      const store = transaction.objectStore('entry');
      const index = store.index('readState');
      const request = index.count(FeedCache.EntryFlags.UNREAD);
      const boundOnRequest = this.onCountUnreadEntries.bind(this, callback);
      request.addEventListener('success', boundOnRequest);
      request.addEventListener('error', boundOnRequest);
    } else {
      this.log.error('BadgeUpdateService: cache connection error');
      chrome.browserAction.setBadgeText({'text': '?'});
      if(callback) {
        callback();
      }
    }
  }

  onCountUnreadEntries(callback, event) {
    if(event.type === 'success') {
      const count = event.target.result;
      this.log.debug('BadgeUpdateService: setting count', count);
      chrome.browserAction.setBadgeText({'text': '' + count});
    } else {
      this.log.error(event);
      chrome.browserAction.setBadgeText({'text': '?'});
    }

    event.target.transaction.db.close();
    if(callback) {
      callback();
    }
  }
}
