// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: openIndexedDB

'use strict';

{ // BEGIN FILE SCOPE

// Removes all entries from the entry object store
function clearEntryStore(connection) {
  if(connection) {
    clearWithConnection(connection);
  } else {
    openIndexedDB(onConnect);
  }
}

this.clearEntryStore = clearEntryStore;

function onConnect(event) {
  if(event.type === 'success') {
    const connection = event.target.result;
    clearWithConnection(connection);
  } else {
    console.debug('Connection error, could not clear entries: %o', event);
  }
}

function clearWithConnection(connection) {
  const transaction = connection.transaction('entry', 'readwrite');
  transaction.oncomplete = onClearComplete;
  const store = transaction.objectStore('entry');
  store.clear();
}

function onClearComplete(event) {
  console.debug('Cleared entry object store');
}

} // END FILE SCOPE
