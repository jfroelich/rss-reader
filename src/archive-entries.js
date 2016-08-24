// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// The default period after which entries become archivable
const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;

// Iterates over entries in storage and archives older entries
// @param expires_after_ms {number} an entry is archivable if older than this.
// if not set, a default value of 10 days is used.
this.archive_entries = function(expires_after_ms) {
  console.log('Archiving entries...');

  const context = {
    'expires_after_ms': TEN_DAYS_MS,
    'num_processed': 0,
    'num_changed': 0,
    'current_date': new Date()
  };

  if(typeof expires_after_ms !== 'undefined') {
    console.assert(!isNaN(expires_after_ms));
    console.assert(isFinite(expires_after_ms));
    console.assert(expires_after_ms > 0);
    context.expires_after_ms = expires_after_ms;
  }

  open_db(on_open_db.bind(context));
};

function on_open_db(connection) {
  if(!connection) {
    on_complete.call(this);
    return;
  }

  this.connection = connection;
  const transaction = connection.transaction('entry', 'readwrite');
  const store = transaction.objectStore('entry');
  const index = store.index('archiveState-readState');
  const key_path = [Entry.FLAGS.UNARCHIVED, Entry.FLAGS.READ];
  const request = index.openCursor(key_path);
  request.onsuccess = open_cursor_onsuccess.bind(this);
  request.onerror = open_cursor_onerror.bind(this);
}

function open_cursor_onsuccess(event) {
  const cursor = event.target.result;
  if(!cursor) {
    on_complete.call(this);
    return;
  }

  this.num_processed++;

  // TODO: maybe the serialization is a waste. Maybe just work on the serialized
  // object itself and avoid the serialization entirely.

  const entry = deserialize_entry(cursor.value);
  console.assert(entry.dateCreated);
  console.assert(this.current_date >= entry.dateCreated);
  const age = this.current_date - entry.dateCreated;

  if(age > this.expires_after_ms) {
    const archived = to_archive_form(entry);
    const serialized = serialize_entry(archived);
    console.debug('Archiving', entry.get_url().toString());
    console.assert(serialized.id);
    cursor.update(serialized);
    send_message(entry.id);
    this.num_changed++;
  }

  cursor.continue();
}

// Returns a new Entry instance representing the archived form of the input
// entry
function to_archive_form(input_entry) {
  const entry = new Entry();
  entry.archiveState = Entry.FLAGS.ARCHIVED;
  entry.dateArchived = new Date();

  if(input_entry.dateRead) {
    entry.dateRead = clone_date(input_entry.dateRead);
  }

  entry.feed = input_entry.feed;
  entry.id = input_entry.id;
  entry.readState = input_entry.readState;

  if(input_entry.urls) {
    entry.urls = [];
    for(let url of input_entry.urls) {
      entry.urls.push(clone_url(url));
    }
  }

  return entry;
}

function clone_date(date) {
  return new Date(date.getTime());
}

function clone_url(url) {
  return new URL(url.href);
}

function open_cursor_onerror(event) {
  console.error(event.target.error);
  on_complete.call(this);
}

function send_message(entry_id) {
  // TODO: use postMessage instead of relying on chrome api?
  // NOTE: the message listener expects "entryId" not "entry_id"
  chrome.runtime.sendMessage({
    'type': 'archiveEntryRequested',
    'entryId': entry_id
  });
}

function on_complete() {
  console.log('Archived %s of %s entries', this.num_changed,
    this.num_processed);
  if(this.connection) {
    this.connection.close();
  }
}

} // End file block scope
