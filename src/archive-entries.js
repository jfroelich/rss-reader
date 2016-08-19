// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

const TEN_DAYS_MILLIS = 10 * 24 * 60 * 60 * 1000;

// Iterates over entries in storage and archives older entries
this.archive_entries = function(expires_after_millis) {
  console.log('Archiving entries...');

  if(typeof expires_after_millis !== 'undefined') {
    console.assert(!isNaN(expires_after_millis));
    console.assert(isFinite(expires_after_millis));
    console.assert(expires_after_millis > 0);
  }

  const context = {
    'expires_after_millis': TEN_DAYS_MILLIS,
    'num_processed': 0,
    'num_changed': 0,
    'currentDate': new Date()
  };

  if(typeof expires_after_millis === 'number') {
    context.expires_after_millis = expires_after_millis;
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
  const keyPath = [Entry.FLAGS.UNARCHIVED, Entry.FLAGS.READ];
  const request = index.openCursor(keyPath);
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

  // TODO: maybe deserialization and reserialization is just an extra
  // hoop and wasted processing. Maybe just work on the serialized object
  // itself

  const entry = deserialize_entry(cursor.value);
  console.assert(entry.dateCreated);
  console.assert(this.currentDate >= entry.dateCreated);
  const age = this.currentDate - entry.dateCreated;

  if(age > this.expires_after_millis) {
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
function to_archive_form(inputEntry) {
  const entry = new Entry();
  entry.archiveState = Entry.FLAGS.ARCHIVED;
  entry.dateArchived = new Date();

  if(inputEntry.dateRead) {
    entry.dateRead = clone_date(inputEntry.dateRead);
  }

  entry.feed = inputEntry.feed;
  entry.id = inputEntry.id;
  entry.readState = inputEntry.readState;

  if(inputEntry.urls) {
    entry.urls = [];
    for(let url of inputEntry.urls) {
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

function send_message(entryId) {
  // TODO: use postMessage instead of relying on chrome api?
  chrome.runtime.sendMessage({
    'type': 'archiveEntryRequested',
    'entryId': entryId
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
