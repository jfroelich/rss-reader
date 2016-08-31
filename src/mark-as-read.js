// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

function mark_as_read(entry_id, callback) {
  console.assert(!isNaN(entry_id));
  console.assert(isFinite(entry_id));
  console.assert(entry_id > 0);
  const context = {'entry_id': entry_id, 'callback': callback};
  open_db(on_open_db.bind(context));
}

function on_open_db(connection) {
  if(!connection) {
    on_complete.call(this, 'ConnectionError');
    return;
  }

  this.connection = connection;
  const transaction = connection.transaction('entry', 'readwrite');
  const store = transaction.objectStore('entry');
  const request = store.openCursor(this.entry_id);
  request.onsuccess = open_cursor_onsuccess.bind(this);
  request.onerror = open_cursor_onerror.bind(this);
}

function open_cursor_onsuccess(event) {
  const cursor = event.target.result;
  if(!cursor) {
    console.error('No entry found', this.entry_id);
    on_complete.call(this, 'NotFoundError');
    return;
  }

  const entry = cursor.value;
  if(entry.readState === Entry.FLAGS.READ) {
    console.error('Already read', this.entry_id);
    on_complete.call(this, 'AlreadyReadError');
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
  update_badge(this.connection);

  on_complete.call(this, 'Success');
}

function open_cursor_onerror(event) {
  console.warn(event.target.error);
  on_complete.call(this, 'CursorError');
}

function on_complete(event_type_str) {
  if(this.connection) {
    this.connection.close();
  }

  if(this.callback) {
    this.callback({
      'type': event_type_str,
      'entry_id': this.entry_id
    });
  }
}

this.mark_as_read = mark_as_read;

} // End file block scope
