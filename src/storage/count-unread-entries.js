// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: EntryStore

// Calls the callback with an event from querying storage
function countUnreadEntries(connection, callback) {
  'use strict';
  const transaction = connection.transaction('entry');
  const store = transaction.objectStore('entry');
  const index = store.index('readState');
  const range = IDBKeyRange.only(EntryStore.UNREAD);
  const request = index.count(range);
  request.onsuccess = callback;
}
