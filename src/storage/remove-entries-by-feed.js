// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // BEGIN FILE SCOPE

function removeEntriesByFeed(connection, id, callback) {
  const transaction = connection.transaction('entry', 'readwrite');
  transaction.oncomplete = callback;
  const store = transaction.objectStore('entry');
  const index = store.index('feed');
  const request = index.openCursor(id);
  request.onsuccess = deleteEntryAndContinue;
}

this.removeEntriesByFeed = removeEntriesByFeed;

function deleteEntryAndContinue(event) {
  const cursor = event.target.result;
  if(cursor) {
    cursor.delete();
    cursor.continue();
  }
}

} // END FILE SCOPE
