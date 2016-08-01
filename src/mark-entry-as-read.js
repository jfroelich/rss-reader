// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function markEntryAsRead(entryId, callback) {
  console.assert(entryId, 'entryId is required');
  console.debug('Marking entry %s as read', entryId);

  const context = {
    'entryId': entryId,
    'callback': callback
  };

  openIndexedDB(markEntryAsReadOnOpenDatabase.bind(this, context));
}

function markEntryAsReadOnOpenDatabase(context, connection) {
  if(!connection) {
    if(context.callback) {
      context.callback({
        'type': 'ConnectionError',
        'entryId': context.entryId
      });
    }
    return;
  }

  const transaction = connection.transaction('entry', 'readwrite');
  const store = transaction.objectStore('entry');
  const request = store.openCursor(context.entryId);
  request.onsuccess = markEntryAsReadOnOpenCursor.bind(null, context);
  request.onerror = markEntryAsReadOnOpenCursor.bind(null, context);
}

function markEntryAsReadOnOpenCursor(context, event) {
  const cursor = event.target.result;
  if(!cursor) {
    console.error('No entry found for id %i to mark as read', context.entryId);
    if(context.callback) {
      context.callback({
        'type': 'NotFoundError',
        'entryId': context.entryId
      });
    }
    return;
  }

  const entry = cursor.value;
  if(entry.readState === Entry.FLAGS.READ) {
    console.error('Attempted to remark read entry with id %i as read',
      context.entryId);
    if(context.callback) {
      context.callback({
        'type': 'AlreadyReadError',
        'entryId': context.entryId
      });
    }
    return;
  }

  entry.readState = Entry.FLAGS.READ;
  const dateNow = new Date();
  entry.dateRead = dateNow;
  entry.dateUpdated = dateNow;
  cursor.update(entry);

  updateBadgeUnreadCount();

  if(context.callback) {
    context.callback({
      'type': 'success',
      'entryId': context.entryId
    });
  }
}
