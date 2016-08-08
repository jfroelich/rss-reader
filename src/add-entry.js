
// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function addEntry(connection, entry, callback) {
  console.assert(entry, 'Entry is required');
  console.assert(entry.getURL(), 'Entry missing url');
  console.debug('Adding entry', entry.getURL().href);

  // TODO: this would be easier if I called sanitize first and sanitize
  // returned a new Entry object.

  let storable = entry.serialize();
  storable = Entry.prototype.sanitize.call(storable);
  storable.readState = Entry.FLAGS.UNREAD;
  storable.archiveState = Entry.FLAGS.UNARCHIVED;
  storable.dateCreated = new Date();

  const transaction = connection.transaction('entry', 'readwrite');
  const entryStore = transaction.objectStore('entry');
  const request = entryStore.add(storable);
  request.onsuccess = callback;
  request.onerror = callback;
}
