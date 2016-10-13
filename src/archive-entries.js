// See license.md

'use strict';

{

function archiveEntries(db, age, log, callback) {
  const defaultMaxAge = 10 * 24 * 60 * 60 * 1000;// 10 days in ms

  if(typeof age !== 'undefined') {
    if(!Number.isInteger(age) || age < 0) {
      throw new TypeError();
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
  conn.close();
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
    this.log.debug('Entry missing dateCreated', entry);
    return cursor.continue();
  }

  const age = this.currentDate - entry.dateCreated;

  // An entry should be archived if its age is greater than age. Otherwise,
  // ignore it. This also ignores entries somehow containing a future date
  if(age < this.age) {
    return cursor.continue();
  }

  this.numEntriesModified++;
  const compactedEntry = compact.call(this, entry);

  if(this.log === console) {
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
