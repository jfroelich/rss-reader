// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

this.unsubscribe = function(feedId, callback) {
  console.debug('Unsubscribing from', feedId);

  console.assert(feedId && !isNaN(feedId), 'invalid id');

  const context = {
    'connection': null,
    'feedId': feedId,
    'deleteRequestCount': 0,
    'callback': callback
  };

  open_db(on_open_db.bind(context));
};

function on_open_db(connection) {
  if(connection) {
    this.connection = connection;
    // Open a cursor over the entries for the feed
    const transaction = connection.transaction('entry', 'readwrite');
    const store = transaction.objectStore('entry');
    const index = store.index('feed');
    const request = index.openCursor(this.feedId);
    request.onsuccess = on_open_cursor.bind(this);
    request.onerror = on_open_cursor.bind(this);
  } else {
    on_complete.call(this, 'ConnectionError');
  }
}

function on_open_cursor(event) {
  if(event.type === 'error') {
    console.error(event);
    on_complete.call(this, 'DeleteEntryError');
    return;
  }

  const cursor = event.target.result;
  if(cursor) {
    const entry = cursor.value;
    // Delete the entry at the cursor (async)
    cursor.delete();
    // Track the number of delete requests
    this.deleteRequestCount++;

    // Async, notify interested 3rd parties the entry will be deleted
    chrome.runtime.sendMessage({
      'type': 'entryDeleteRequested',
      'entryId': entry.id
    });
    cursor.continue();
  } else {
    on_remove_entries.call(this);
  }
}

function on_remove_entries() {
  console.debug('Deleting feed with id', this.feedId);
  const transaction = this.connection.transaction('feed', 'readwrite');
  const store = transaction.objectStore('feed');
  const request = store.delete(this.feedId);
  request.onsuccess = delete_feed_onsuccess.bind(this);
  request.onerror = delete_feed_onerror.bind(this);
}

function delete_feed_onsuccess(event) {
  on_complete.call(this, 'success');
}

function delete_feed_onerror(event) {
  console.warn(event.target.error);
  on_complete.call(this, 'DeleteFeedError');
}

function on_complete(eventType) {

  console.log('Unsubscribed');

  if(this.connection) {
    if(this.deleteRequestCount) {
      console.debug('Requested %i entries to be deleted',
        this.deleteRequestCount);
      // Share the db connection with badge update so it doesn't need to
      // reconnect. Even though the deletes are pending, the readonly
      // transaction in update_badge implicitly waits for the pending deletes to
      // complete
      update_badge(this.connection);
    }

    this.connection.close();
  }

  if(this.callback) {
    this.callback({
      'type': eventType,
      'feedId': this.feedId,
      'deleteRequestCount': this.deleteRequestCount
    });
  }
}

} // End file block scope
