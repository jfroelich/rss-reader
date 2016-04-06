// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Lib for archiving old entries
// Requires: /src/db.js
// Requirse: /src/entry.js

// Queries storage for currently archivable entries and archives them.
function archive_entries() {
  'use strict';

  console.log('Archiving entries');
  db_open(archive_entries_on_connect);
}

// Open a read-write transaction on the entry store and request all
// entries that are not archived and marked as read, and then start iterating.
function archive_entries_on_connect(event) {
  'use strict';

  if(event.type !== 'success') {
    console.debug(event);
    return;
  }

  const stats = {
    processed: 0,
    archived: 0
  };

  // TODO: I think I would like this to call out to a db function that
  // returns the request object. Maybe this could be a function in the
  // entry.js lib.
  const connection = event.target.result;
  const transaction = connection.transaction('entry', 'readwrite');
  transaction.oncomplete = archive_entries_on_complete.bind(transaction,
    stats);
  const store = transaction.objectStore('entry');
  const index = store.index('archiveState-readState');
  const keyPath = [ENTRY_FLAGS.UNARCHIVED, ENTRY_FLAGS.READ];
  const request = index.openCursor(keyPath);
  request.onsuccess = archive_next_entry.bind(request, stats);
}

// Iterate over the entries loaded by archive_entries_on_connect. Check if an
// entry should be archived, and if so, archives it and then proceeds to
// the next entry.
function archive_next_entry(stats, event) {
  'use strict';

  const request = event.target;
  const cursor = request.result;
  if(!cursor) {
    return;
  }

  stats.processed++;

  // 30 days
  const EXPIRES_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
  const entry = cursor.value;

  // TODO: i don't like how this directly accesses the created property.
  const ageInMillis = Date.now() - entry.created;
  const shouldArchiveEntry = ageInMillis > EXPIRES_AFTER_MS;

  if(shouldArchiveEntry) {
    const newEntry = entry_to_archive(entry);
    cursor.update(newEntry);
    const archiveMessage = {type: 'archivedEntry', entry: entry};
    chrome.runtime.sendMessage(archiveMessage);
    stats.archived++;
  }

  cursor.continue();
}

function archive_entries_on_complete(stats, event) {
  'use strict';
  console.log('Archived %s of %s entries', stats.archived, stats.processed);
}
