// See license.md

'use strict';

// TODO: maybe use a single property with 4 values instead of two separate
// properties for read state and archive state. This will speed up the query
// TODO: if I want a history view, I probably need to retain title and
// favicon

{

function archiveEntries(db, age, log, callback) {
  const defaultMaxAge = 10 * 24 * 60 * 60 * 1000;// 10 days in ms

  if(typeof age !== 'undefined') {
    if(!Number.isInteger(age)) {
      throw new TypeError('age not an integer');
    }
    if(age < 0) {
      throw new TypeError('age not positive');
    }
  } else {
    age = defaultMaxAge;
  }

  const ctx = {
    'numEntriesProcessed': 0,
    'numEntriesModified': 0,
    'age': age,
    'db': db,
    'currentDate': new Date(),
    'callback': callback,
    'log': log || SilentConsole
  };

  ctx.log.log('Archiving entries with age', age);
  db.open(openDBOnSuccess.bind(ctx), openDBOnError.bind(ctx));
}

function openDBOnSuccess(event) {
  this.log.debug('Connected to database', this.db.name);

  const conn = event.target.result;
  const tx = conn.transaction('entry', 'readwrite');
  tx.oncomplete = onComplete.bind(this);
  const store = tx.objectStore('entry');
  const index = store.index('archiveState-readState');
  const keyPath = [Entry.UNARCHIVED, Entry.READ];
  const request = index.openCursor(keyPath);
  request.onsuccess = openCursorOnSuccess.bind(this);
  request.onerror = openCursorOnError.bind(this);
  conn.close(); // implicitly waits till tx completes
}

function openDBOnError(event) {
  this.log.error(event.target.error);
  onComplete.call(this, null);
}

function openCursorOnSuccess(event) {
  const cursor = event.target.result;
  if(!cursor) {
    return;
  }

  this.numEntriesProcessed++;
  const entry = cursor.value;

  if(!entry.dateCreated) {
    this.log.debug('Entry is missing dateCreated');
    return cursor.continue();
  }

  // Age will be negative if the entry was somehow created in the future.
  // If age is negative then the following test always fails.
  const age = this.currentDate - entry.dateCreated;// in ms

  // An entry should be archived if its age is greater than age. Otherwise,
  // ignore it.
  if(age <= this.age) {
    return cursor.continue();
  }

  this.numEntriesModified++;
  const compactedEntry = compact.call(this, entry);

  if(this.log !== SilentConsole) {
    const beforeSize = sizeof(entry);
    const afterSize = sizeof(compactedEntry);
    this.log.debug('Compacted %s (age %s, before %s, after %s)',
      Entry.getURL(entry), age, beforeSize, afterSize);
  }

  cursor.update(compactedEntry);
  const message = {'type': 'archiveEntryPending', 'id': entry.id};
  chrome.runtime.sendMessage(message);
  cursor.continue();
}

function openCursorOnError(event) {
  this.log.error(event.target.error);
}

// TODO: should this be forcing articles to be considered read?
function compact(entry) {
  const output = {};
  output.archiveState = Entry.ARCHIVED;
  output.dateArchived = this.currentDate;
  output.dateCreated = entry.dateCreated;
  if(entry.dateRead) {
    output.dateRead = entry.dateRead;
  }
  output.feed = entry.feed;
  output.id = entry.id;
  output.readState = entry.readState;
  output.urls = entry.urls;
  return output;
}

function onComplete(event) {
  this.log.log('archiveEntries completed (scanned %s, compacted %s)',
    this.numEntriesProcessed, this.numEntriesModified);
  if(this.callback) {
    this.callback();
  }
}

this.archiveEntries = archiveEntries;

}
