// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Searches the entry store for an entry with the given link property
// and passes the event representing the first match to the callback, or
// an event with an undefined/null result if no match was found

function findEntryByLink(connection, entryLink, callback) {
  'use strict';
  const transaction = connection.transaction('entry');
  const entries = transaction.objectStore('entry');
  const links = entries.index('link');
  const request = links.get(entryLink);
  request.onsuccess = callback;
}
