// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: once I create FeedStorageService or whatever it is called, this should
// just be a member function of that module

function markEntryAsRead(entryId, callback) {

  const outputEvent = {'entryId': entryId};
  const cache = new FeedCache();
  cache.open(onOpenDatabase);

  function onOpenDatabase(connection) {
    if(!connection) {
      outputEvent.type = 'connectionerror';
      if(callback) {
        callback(outputEvent);
      }
      return;
    }

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

    updateBadgeUnreadCount();

    outputEvent.type = 'success';
    if(callback) {
      callback(outputEvent);
    }
  }
}
