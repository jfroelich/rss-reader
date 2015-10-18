// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Archive entries lib. Archiving involves periodically compressing
// old entries to reduce storage used.
// TODO: this feature needs more thought put into it, this is 
// currently in a temporary semi-working state
// TODO: maybe archive should just use a separate object store of just 
// urls. Then check for new should have to do 2 look ups, but 
// the un-archived object store will be much more compact?
// A vertical partition?
// TODO: regarding consistency, what happens when we archive an
// article that is currently loaded in view, if that is 
// possible? This requires some more thought. Are there even any
// negative side effects? Does the mark-as-read feature still work?

const ARCHIVE_ALARM_SCHEDULE = {
  periodInMinutes: 24 * 60
};

chrome.alarms.create('archive', ARCHIVE_ALARM_SCHEDULE);
chrome.alarms.onAlarm.addListener(function(alarm) {
  if(alarm.name === 'archive') {
    archiveEntries();
  }
});

function archiveEntries() {
  'use strict';
  console.log('Starting archival process');
  database.connect(function(error, connection) {

    if(error) {
      console.debug(error);
      return;
    }

    archiveIterateEntries(connection);
  });
}

function archiveOnComplete(tracker, event) {
  'use strict';
  console.log('Archived %s entries', tracker.processed);
}

function archiveIterateEntries(connection) {
  'use strict';

  const tracker = {
    processed: 0
  };

  const ENTRY_LIMIT = 1000;
  const transaction = connection.transaction('entry', 'readwrite');
  transaction.oncomplete = archiveOnComplete.bind(transaction, tracker);
  const store = transaction.objectStore('entry');

  // We want to select only not-archived articles.
  // Otherwise this just repeats itself on the first X entries.
  // So we pick an index that exists for articles where once
  // archived the article would no longer appear in the index. The
  // index on the feed id for each entry works nicely for this
  // purpose.
  const index = store.index('feed');
  const request = index.openCursor();
  request.onsuccess = function(event) {
    const cursor = event.target.result;
    if(!cursor) {
      return;
    }

    tracker.processed++;

    const entry = cursor.value;
    const created = entry.created;

    if(!created) {
      cursor.continue();
      return;
    }

    if(entry.archiveDate) {
      cursor.continue();
      return;
    }

    // TODO: use the same date across each call?
    const now = Date.now();
    const age = now - created;

    // TODO: use a constant?
    const expiresMs = 30 * 24 * 60 * 60 * 1000;
    const shouldArchive = age > expiresMs;

    // NOTE: in an old version this used to avoid archiving unread
    // articles. For now this is ignored (??)
    
    // NOTE: this used to keep feed id so that unsubscribe
    // would delete archived articles as well. Now this keeps those
    // articles
    // This can lead to orphans though, so this probably needs more
    // work. Maybe we store a new property like "oldFeedId" or something
    // and change unsubscribe to delete entries matching feed id or 
    // old feed id

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
    
    if(tracker.processed <= ENTRY_LIMIT) {
      cursor.continue();
    }
  }
}
