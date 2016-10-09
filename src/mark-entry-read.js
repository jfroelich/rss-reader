// See license.md

'use strict';

{

function markEntryRead(id, verbose, callback) {

  if(!Number.isInteger(id) || id < 1) {
    // TODO: use string template?
    throw new Error('invalid entry id: ' + id);
  }

  const log = new LoggingService();
  log.enabled = verbose;

  log.debug('Mark entry %s as read', id);

  const ctx = {'id': id, 'callback': callback, 'log': log};
  const feedDb = new FeedDb();
  feedDb.open(openDBOnSuccess.bind(ctx), openDBOnError.bind(ctx));
}

function openDBOnSuccess(event) {
  this.log.debug('connected to database to mark entry as read');
  const conn = event.target.result;
  this.conn = conn;
  const tx = conn.transaction('entry', 'readwrite');
  const store = tx.objectStore('entry');
  const request = store.openCursor(this.id);
  request.onsuccess = openCursorOnSuccess.bind(this);
  request.onerror = openCursorOnError.bind(this);
}

function openDBOnError(event) {
  this.log.debug(event.target.error);
  onComplete.call(this, 'ConnectionError');
}

function openCursorOnSuccess(event) {
  const cursor = event.target.result;
  if(!cursor) {
    this.log.error('no entry found with id', this.id);
    onComplete.call(this, 'NotFoundError');
    return;
  }

  const entry = cursor.value;
  if(entry.readState === Entry.flags.READ) {
    this.log.error('already read entry with id', entry.id);
    onComplete.call(this, 'AlreadyReadError');
    return;
  }

  this.log.debug('updating entry', entry.id);

  entry.readState = Entry.flags.READ;
  const dateNow = new Date();
  entry.dateRead = dateNow;
  entry.dateUpdated = dateNow;
  cursor.update(entry);

  const verbose = false;
  updateBadge(this.conn, verbose);
  onComplete.call(this, 'Success');
}

function openCursorOnError(event) {
  this.log.error(event.target.error);
  onComplete.call(this, 'CursorError');
}

function onComplete(type) {
  this.log.log('completed marking entry as read');
  if(this.conn) {
    this.log.debug('requesting database to close');
    this.conn.close();
  }

  if(this.callback) {
    this.log.debug('calling back with type', type);
    this.callback({'type': type});
  }
}

this.markEntryRead = markEntryRead;

}
