// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function markEntryAsRead(entryId, callback) {

  const outputEvent = Object.create(null);
  outputEvent.entryId = entryId;

  db.open(onOpenDatabase);

  function onOpenDatabase(event) {
    if(event.type !== 'success') {
      console.debug(event);
      outputEvent.type = 'connectionerror';
      if(callback) {
        callback(outputEvent);
      }
      return;
    }

    const connection = event.target.result;
    db.getEntryById(connection, entryId, onOpenCursor);
  }

  function onOpenCursor(event) {
    const request = event.target;
    const cursor = request.result;

    if(!cursor) {
      outputEvent.type = 'notfounderror';
      if(callback) {
        callback(outputEvent);
      }
      return;
    }

    const entry = cursor.value;
    if(entry.readState === db.EntryFlags.READ) {
      outputEvent.type = 'alreadyreaderror';
      if(callback) {
        callback(outputEvent);
      }
      return;
    }

    entry.readState = db.EntryFlags.READ;
    const dateNow = new Date();
    entry.dateRead = dateNow;
    entry.dateUpdated = dateNow;

    cursor.update(entry);

    const connection = request.transaction.db;
    updateBadgeUnreadCount(connection);

    outputEvent.type = 'success';
    if(callback) {
      callback(outputEvent);
    }
  }
}
