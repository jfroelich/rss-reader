// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const markAsRead = {};

markAsRead.start = function(entryId, callback) {
  console.assert(typeof entryId === 'number' && isFinite(entryId) &&
    entryId > 0, 'invalid entryId %s', entryId);
  console.debug('Marking entry %i as read', entryId);

  // Define a context to simplify parameter passing
  const context = {'entryId': entryId, 'callback': callback};
  openIndexedDB(markAsRead.onOpenDatabase.bind(this));
};

markAsRead.onOpenDatabase = function(connection) {
  if(!connection) {
    markAsRead.onComplete.call(this, 'ConnectionError');
    return;
  }

  // Cache the connection in the context so that it can be easily closed
  this.connection = connection;

  // Open a cursor as opposed to using get so that we can use cursor.update
  const transaction = this.connection.transaction('entry', 'readwrite');
  const store = transaction.objectStore('entry');
  const request = store.openCursor(this.entryId);
  request.onsuccess = markAsRead.openCursorOnSuccess.bind(this);
  request.onerror = markAsRead.openCursorOnError.bind(this);
};

markAsRead.openCursorOnSuccess = function(event) {
  const cursor = event.target.result;
  if(!cursor) {
    console.error('No entry found for id %i to mark as read', this.entryId);
    markAsRead.onComplete.call(this, 'NotFoundError');
    return;
  }

  const entry = cursor.value;
  if(entry.readState === Entry.FLAGS.READ) {
    console.error('Attempted to remark read entry with id %i as read',
      this.entryId);
    markAsRead.onComplete.call(this, 'AlreadyReadError');
    return;
  }

  entry.readState = Entry.FLAGS.READ;
  const dateNow = new Date();
  entry.dateRead = dateNow;
  entry.dateUpdated = dateNow;

  // Async. Request an update on the same readwrite transaction, and do not
  // wait for it to complete.
  cursor.update(entry);

  // Async. This call is implicitly blocked by the readwrite transaction used
  // here, so the count of unread will be affected, even though we do not
  // wait for cursor.update to complete.
  badge.update(this.connection);

  markAsRead.onComplete.call(this, 'Success');
};

markAsRead.openCursorOnError = function(event) {
  console.warn('Error opening cursor when marking entry as read', event);
  markAsRead.onComplete.call(this, 'CursorError');
};

markAsRead.onComplete = function(eventType) {
  if(this.connection) {
    this.connection.close();
  }

  if(this.callback) {
    this.callback({
      'type': eventType,
      'entryId': this.entryId
    });
  }
};
