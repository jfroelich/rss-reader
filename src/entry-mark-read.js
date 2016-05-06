// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Mark entry as read functionality
// Requires: /src/entry.js
// Requires: /src/utils.js

// Marks the entry with the corresponding entryId as read in storage.
function entry_mark_as_read(connection, entryId) {
  const transaction = connection.transaction('entry', 'readwrite');
  const store = transaction.objectStore('entry');
  const request = store.openCursor(entryId);
  request.onsuccess = entry_mark_as_read_on_open_cursor;
}

function entry_mark_as_read_on_open_cursor(event) {
  const request = event.target;
  const cursor = request.result;

  // No matching entry found
  if(!cursor) {
    return;
  }

  const entry = cursor.value;

  if(entry.readState === ENTRY_FLAGS.READ) {
    console.debug('Attempted to remark a read entry as read:', entry.id);
    return;
  }

  entry.readState = ENTRY_FLAGS.READ;
  entry.dateRead = new Date();

  // Trigger an update request. Do not wait for it to complete.
  const updateRequest = cursor.update(entry);

  // NOTE: while this occurs concurrently with the update request,
  // it involves a separate read transaction that is implicitly blocked by
  // the current readwrite request, so it still occurs afterward.
  const connection = request.transaction.db;
  utils.updateBadgeText(connection);

  // Notify listeners that an entry was read.
  // NOTE: this happens async. The entry may not yet be updated.
  const entryReadMessage = {'type': 'entryRead', 'entryId': entry.id};
  chrome.runtime.sendMessage(entryReadMessage);
}
