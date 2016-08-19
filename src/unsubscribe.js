// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

this.unsubscribe = function(feed_id, callback) {
  console.debug('Unsubscribing from', feed_id);
  console.assert(feed_id);
  console.assert(!isNaN(feed_id));

  const context = {
    'connection': null,
    'feed_id': feed_id,
    'num_delete_entry_requests': 0,
    'callback': callback
  };

  open_db(on_open_db.bind(context));
};

function on_open_db(connection) {
  if(connection) {
    this.connection = connection;
    const transaction = connection.transaction('entry', 'readwrite');
    const store = transaction.objectStore('entry');
    const index = store.index('feed');
    const request = index.openCursor(this.feed_id);
    request.onsuccess = open_entry_cursor_onsuccess.bind(this);
    request.onerror = open_entry_cursor_onerror.bind(this);
  } else {
    on_complete.call(this, 'ConnectionError');
  }
}

function open_entry_cursor_onsuccess(event) {
  const cursor = event.target.result;
  if(cursor) {
    const entry = cursor.value;
    cursor.delete(); // async
    this.num_delete_entry_requests++;

    // Async
    chrome.runtime.sendMessage({
      'type': 'entryDeleteRequested',
      'entryId': entry.id
    });
    cursor.continue();
  } else {
    on_remove_entries.call(this);
  }
}

function open_entry_cursor_onerror(event) {
  console.error(event.target.error);
  on_complete.call(this, 'DeleteEntryError');
}

function on_remove_entries() {
  console.debug('Deleting feed', this.feed_id);
  const transaction = this.connection.transaction('feed', 'readwrite');
  const store = transaction.objectStore('feed');
  const request = store.delete(this.feed_id);
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

function on_complete(event_type) {

  console.log('Unsubscribed');

  if(this.connection) {
    if(this.num_delete_entry_requests) {
      console.debug('Requested %i entries to be deleted',
        this.num_delete_entry_requests);
      // Share the db connection with badge update so it doesn't need to
      // reconnect. Even though the deletes are pending, the readonly
      // transaction in update_badge implicitly waits for the pending deletes to
      // complete
      update_badge(this.connection);
    }

    this.connection.close();
  }

  if(this.callback) {
    // Has to callback using "feedId" because callers assume that property
    // name. Same thing with "deleteRequestCount"
    this.callback({
      'type': event_type,
      'feedId': this.feed_id,
      'deleteRequestCount': this.num_delete_entry_requests
    });
  }
}

} // End file block scope
