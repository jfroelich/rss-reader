// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: once I create FeedStorageService or whatever it is called, this should
// just be a member function of that module

function markEntryAsRead(entryId, callback) {

  const cache = new FeedCache();

  const outputEvent = Object.create(null);
  outputEvent.entryId = entryId;

  cache.open(onOpenDatabase);

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
    cache.getEntryById(connection, entryId, onOpenCursor);
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
    if(entry.readState === FeedCache.EntryFlags.READ) {
      outputEvent.type = 'alreadyreaderror';
      if(callback) {
        callback(outputEvent);
      }
      return;
    }

    entry.readState = FeedCache.EntryFlags.READ;
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
