// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

// Archive entries lib. Archiving involves periodically compressing
// old entries to reduce storage used.
// TODO: this feature needs more thought put into it, this is 
// currently in a temporary semi-working state

// TODO: maybe archive should just use a separate object store of just 
// urls. Then check for new should have to do 2 look ups, but 
// the un-archived object store will be much more compact?

lucu.archive = {};

lucu.archive.start = function() {
  'use strict';
  var waterfall = [
    lucu.archive.connect,
    lucu.archive.selectEntries
  ];

  async.waterfall(waterfall, lucu.archive.onComplete);
};


lucu.archive.connect = function(callback) {
  'use strict';
  lucu.database.connect(callback, callback);
};

lucu.archive.selectEntries = function(database, callback) {
  'use strict';

  // We want to select only not-archived articles.
  // Otherwise this just repeats itself on the first X entries.
  // So we pick an index that exists for articles where once
  // archived the article would no longer appear in the index. The
  // index on the feed id for each entry works nicely for this
  // purpose.

  var transaction = database.transaction('entry', 'readwrite');
  var store = transaction.objectStore('entry');
  var index = store.index('feed');
  var request = index.openCursor();

  // Journal is an object shared across function calls, like a 
  // memoized object, so that each iteration over an entry and 
  // update its properties. Basically we use an object wrapping
  // a primitive so multiple functions can update the same
  // primitive by ref instead of by val, because it doesn't work
  // by val because prim vals are copied into function calls and
  // become independent
  var journal = {
    processed: 0
  };

  request.onsuccess = lucu.archive.handleEntry.bind(request, journal);
  tx.oncomplete = callback.bind(null, journal);
};

lucu.archive.ENTRY_LIMIT = 1000;

lucu.archive.handleEntry = function(journal, event) {
  'use strict';

  var cursor = event.target.result;
  
  // This eventually causes the transaction to complete
  if(!cursor) {
    return;
  }

  var entry = cursor.value;
  var created = entry.created;

  // Allow for partially corrupted storage
  if(!created) {
    console.debug('Unknown date created for entry %s', JSON.stringify(entry));
    journal.processed++;
    cursor.continue();
    return;
  }

  if(entry.archiveDate) {
    console.warn('Not re-archiving entry %s', JSON.stringify(entry));
    journal.processed++;
    cursor.continue();
    return;
  }

  // TODO: use the same date across each call?
  var now = Date.now();
  var age = now - created;

  // TODO: use an external constant?
  var expiresMs = 30 * 24 * 60 * 60 * 1000;
  var shouldArchive = age > expiresMs;

  // NOTE: in an old version this used to avoid archiving unread
  // articles. For now this is ignored (??)
  
  // NOTE: this used to keep feed id so that unsubscribe
  // would delete archived articles as well. Now this keeps those
  // articles
  // This can lead to orphans though, so this probably needs more
  // work. Maybe we store a new property like "oldFeedId" or something
  // and change unsubscribe to delete entries matching feed id or 
  // old feed id

  // TODO: regarding consistency, what happens when we archive an
  // article that is currently loaded in view, if that is 
  // possible? This requires some more thought. Are there even any
  // negative side effects? Does the mark-as-read feature still work?

  if(shouldArchive) {
    delete entry.content;
    delete entry.feed;
    delete entry.feedLink;
    delete entry.feedTitle;
    delete entry.pubdate;
    delete entry.readDate;
    delete entry.title;
    entry.archiveDate = now;
    cursor.update(entry);
  }

  journal.processed++;
  
  if(journal.processed > lucu.archive.ENTRY_LIMIT) {
    return;
  }

  cursor.continue();
};

lucu.archive.onComplete = function(journal) {
  'use strict';
  console.debug('Archived %s entries', journal.processed);
};

lucu.archive.ALARM_NAME = 'archive';

lucu.archive.onAlarm = function(alarm) {
  if(alarm.name == lucu.archive.ALARM_NAME) {
    lucu.archive.start();
  }
};

lucu.archive.ALARM_SCHEDULE = {periodInMinutes: 24 * 60};
chrome.alarms.onAlarm.addListener(lucu.archive.onAlarm);
chrome.alarms.create(lucu.archive.ALARM_NAME, lucu.archive.ALARM_SCHEDULE);
