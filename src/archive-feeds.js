// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

/**
 * Iterate over entries in storage and archive certain entries
 * if conditions are met.
 * TODO: use caolan async.each
 */
lucu.archiveFeeds = function() {
  'use strict';

  var request = indexedDB.open(lucu.DB_NAME, lucu.DB_VERSION);
  request.onerror = console.error;
  request.onblocked = console.error;
  request.onsuccess = function (event) {
    var db = event.target.result;
    var transaction = db.transaction('entry','readwrite');
    var store = transaction.objectStore('entry');
    var expiresMs = 30 * 24 * 60 * 60 * 1000;
    var now = Date.now();
    // We want to instead select only not-archived articles.
    // Otherwise this just repeats itself on the first X entries.
    // So we  pick an index that exists for articles where once
    // archived the article would no longer appear in the index. The
    // index on the feed id for each entry works nicely for this
    // purpose.
    var index = store.index('feed');
    var request = index.openCursor();
    var processed = 0, limit = 1000;
    request.onsuccess = function() {
      var cursor = this.result;
      if(!cursor) return;
      if(processed >= limit) {
        return;
      }

      var entry = cursor.value;
      var created = entry.created;
      if(!created) {
        console.debug('Unknown date created for entry %s, unable to archive',
          JSON.stringify(entry));
        processed++;
        return cursor.continue();
      }

      // If this happens something is wrong
      if(entry.archiveDate) {
        console.warn('Entry already archived, not re-archiving %s', JSON.stringify(entry));
        processed++;
        return cursor.continue();
      }

      var age = now - created;
      var shouldArchive = age > expiresMs;
      // NOTE: in an old version this used to avoid archiving unread
      // articles. For now this is ignored.
      // NOTE: this used to keep feed id so that unsubscribe
      // would delete archived articles as well
      if(shouldArchive) {
        delete entry.content;
        delete entry.feed;
        delete entry.feedLink;
        delete entry.feedTitle;
        delete entry.pubdate;
        delete entry.readDate;
        delete entry.title;
        entry.archiveDate = now;
        // console.debug('Archiving %s', entry.id);
        cursor.update(entry);
      }

      processed++;
      cursor.continue();
    };

    transaction.oncomplete = function () {
      console.debug('Archived %s entries', processed);
    };
  };
};
