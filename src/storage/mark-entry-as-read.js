// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: update-badge.js
// Requires: EntryStore

// TODO: should this also update a dateUpdated property of the entry?
// TODO: should something else be responsible for the badge update stuff, like
// a decoupled listener?

'use strict';

{ // BEGIN FILE SCOPE

// Updates the read state of the corresponding entry in the database
function markEntryAsRead(connection, entryId) {
  const transaction = connection.transaction('entry', 'readwrite');
  const store = transaction.objectStore('entry');
  const request = store.openCursor(entryId);
  request.onsuccess = markReadOnSuccess;
}

this.markEntryAsRead = markEntryAsRead;

function markReadOnSuccess(event) {

  const request = event.target;

  const cursor = request.result;
  // If cursor is undefined, then no entry matched the id, so do nothing
  if(!cursor) {
    return;
  }

  const entry = cursor.value;
  // An entry matched, but it is undefined. This should never happen?
  if(!entry) {
    console.debug('Got cursor but no entry?? %o', cursor);
    return;
  }

  // If the entry is already marked as read, do nothing
  if(entry.readState === EntryStore.READ) {
    return;
  }

  // Change properties and update
  entry.readState = EntryStore.READ;
  entry.readDate = Date.now();
  cursor.update(entry);

  // Update the unread count as a result
  const connection = request.transaction.db;
  updateBadge(connection);

  // Notify any interested listeners
  const message = {type: 'entryRead', entry: entry};
  chrome.runtime.sendMessage(message);
}

} // END FILE SCOPE
