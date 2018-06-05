import {refresh_badge} from '/src/badge.js';
import {ENTRY_STATE_READ, ENTRY_STATE_UNREAD, is_entry, is_valid_entry_id} from '/src/entry.js';

// TODO: drop the db prefix, the name is a concern of an importing module and
// not a concern of the exporting module, and the prefix is an overqualification

// TODO: the on-load checks of object validity are weird. Why not just use
// basic assert and treat as errors? I don't remember how the code got into this
// state. I am bit concerned if I change these back to throwing error instead
// of just logging error and exiting, it will break stuff.

// TODO: refactor as db-set-entry-read-state, accept a boolean state parameter,
// and handle both cases (where true and where false)? Alternatively, create
// db-write-entry-property, have this decorate that. Alternatively, have the
// caller just call db-write-entry-property directly.

// TODO: create a db-write-entry-property module, then use that instead of this.
// In the interim, can consider refactoring this to basically wrap a call to it,
// maybe even keep the channel message type the same. Then slowly migrate all
// callers to call db-write-entry-property directly. This will potentially
// reduce the number of operations related to entries, and is more forward
// thinking in case new operations are added later (e.g. star/unstar-entry).

// TODO: review
// http://www.micheltriana.com/blog/2012/04/09/library-oriented-architecture



// Asynchronously marks an entry as read in the database.
// @param conn {IDBDatabase}
// @param channel {BroadcastChannel}
// @param entry_id {Number} required
// @error {TypeError} invalid entry id
// @error {DOMError} database error
// @return {Promise} resolves to undefined
export function db_mark_entry_read(conn, channel, entry_id) {
  return new Promise(executor.bind(null, conn, channel, entry_id));
}

function executor(conn, channel, entry_id, resolve, reject) {
  if (!is_valid_entry_id(entry_id)) {
    throw new TypeError('entry_id is not a valid entry id: ' + entry_id);
  }

  const txn = conn.transaction('entry', 'readwrite');
  txn.oncomplete = txn_oncomplete.bind(txn, channel, entry_id, resolve);
  txn.onerror = _ => reject(txn.error);
  const store = txn.objectStore('entry');
  const request = store.get(entry_id);
  request.onsuccess = request_onsuccess.bind(request, entry_id);
}

function request_onsuccess(entry_id, event) {
  const entry = event.target.result;
  if (!entry) {
    console.error('No entry found', entry_id);
    return;
  }

  if (!is_entry(entry)) {
    console.error('Invalid matched object type', entry_id, entry);
    return;
  }

  if (entry.readState === ENTRY_STATE_READ) {
    console.error('Entry already read', entry.id);
    return;
  }

  if (entry.readState !== ENTRY_STATE_UNREAD) {
    console.error('Entry not unread', entry.id);
    return;
  }

  entry.readState = ENTRY_STATE_READ;
  const currentDate = new Date();
  entry.dateUpdated = currentDate;
  entry.dateRead = currentDate;

  const entry_store = event.target.source;
  entry_store.put(entry);
}

function txn_oncomplete(channel, entry_id, callback, event) {
  channel.postMessage({type: 'entry-marked-read', id: entry_id});
  const conn = event.target.db;
  refresh_badge(conn).catch(console.error);
  callback();
}
