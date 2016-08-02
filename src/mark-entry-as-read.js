// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function markEntryAsRead(entryId, callback) {
  console.assert(isFinite(entryId) && entryId > 0,
    'entryId %s must be a defined positive finite number', entryId);
  console.debug('Marking entry %i as read', entryId);

  // Define a context to simplify parameter passing
  const context = {'entryId': entryId, 'callback': callback};
  openIndexedDB(markEntryAsReadOnOpenDatabase.bind(this, context));
}

function markEntryAsReadOnOpenDatabase(context, connection) {
  if(!connection) {
    markEntryAsReadOnComplete(context, 'ConnectionError');
    return;
  }

  // Cache the connection in the context so that it can be easily closed
  context.connection = connection;

  // Open a cursor as opposed to using get so that we can use cursor.update
  const transaction = connection.transaction('entry', 'readwrite');
  const store = transaction.objectStore('entry');
  const request = store.openCursor(context.entryId);
  request.onsuccess = markEntryAsReadOpenCursorOnSuccess.bind(null, context);
  request.onerror = markEntryAsReadOpenCursorOnError.bind(null, context);
}

function markEntryAsReadOpenCursorOnSuccess(context, event) {
  const cursor = event.target.result;
  if(!cursor) {
    console.error('No entry found for id %i to mark as read', context.entryId);
    markEntryAsReadOnComplete(context, 'NotFoundError');
    return;
  }

  const entry = cursor.value;
  if(entry.readState === Entry.FLAGS.READ) {
    console.error('Attempted to remark read entry with id %i as read',
      context.entryId);
    markEntryAsReadOnComplete(context, 'AlreadyReadError');
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
  updateBadgeUnreadCount();

  markEntryAsReadOnComplete(context, 'Success');
}

function markEntryAsReadOpenCursorOnError(context, event) {
  console.warn('Error opening cursor when marking entry as read', event);
  markEntryAsReadOnComplete(context, 'CursorError');
}

function markEntryAsReadOnComplete(context, eventType) {
  if(context.connection) {
    context.connection.close();
  }

  if(context.callback) {
    context.callback({
      'type': eventType,
      'entryId': context.entryId
    });
  }
}
