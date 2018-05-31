import {refresh_badge} from '/src/badge.js';
import {ENTRY_STATE_READ, ENTRY_STATE_UNREAD, is_entry, is_valid_entry_id} from '/src/entry.js';
import {log} from '/src/log.js';

// Marks an entry as read in the database.

// ### Context params
// * **conn** {IDBDatabase} required
// * **channel** {BroadcastChannel} required

// ### Params
// * **entry_id** {Number} required

// ### Impl note on why this throws instead of rejects on bad input
// Rather than reject from within the promise, throw an immediate error. This
// constitutes a serious and permanent programmer error.

// ### Implementation note on why this uses txn completion over request
// completion The promise settles based on the txn, not the get request, because
// we do some post-request operations, and because there is actually more than
// one request involved

// ### Moves old notes from feed-ops docs
// * review
// http://www.micheltriana.com/blog/2012/04/09/library-oriented-architecture

// TODO: refactor as entry_set_read_state, accept a boolean state parameter, and
// handle both cases (where true and where false)
// TODO: or, create db-write-entry-property, have this decorate that, or have
// the caller just call db-write-entry-property directory
// TODO: create a db-write-entry-property module, then use that instead of this.
// In the interim, can consider refactoring this to basically wrap a call to it,
// maybe even keep the channel message type the same. Then slowly migrate all
// callers to call db-write-entry-property directly. This will potentially
// reduce the number of operations related to entries, and is more forward
// thinking in case new operations are added later (e.g. star/unstar-entry).
// TODO: use db-write-entry-property instead

export function db_mark_entry_read(entry_id) {
  if (!is_valid_entry_id(entry_id)) {
    throw new TypeError('entry_id is not a valid entry id: ' + entry_id);
  }

  return new Promise(executor.bind(this, entry_id));
}

function executor(entry_id, resolve, reject) {
  const txn = this.conn.transaction('entry', 'readwrite');
  txn.oncomplete = txn_oncomplete.bind(this, entry_id, resolve);
  txn.onerror = _ => reject(txn.error);
  const store = txn.objectStore('entry');
  const request = store.get(entry_id);
  request.onsuccess = request_onsuccess.bind(this, entry_id);
}

function request_onsuccess(entry_id, event) {
  const entry = event.target.result;
  if (!entry) {
    log('No entry found', entry_id);
    return;
  }

  if (!is_entry(entry)) {
    log('Invalid matched object type', entry_id, entry);
    return;
  }

  if (entry.readState === ENTRY_STATE_READ) {
    log('Entry already read', entry.id);
    return;
  }

  if (entry.readState !== ENTRY_STATE_UNREAD) {
    log('Entry not unread', entry.id);
    return;
  }

  entry.readState = ENTRY_STATE_READ;
  const currentDate = new Date();
  entry.dateUpdated = currentDate;
  entry.dateRead = currentDate;

  const entry_store = event.target.source;
  entry_store.put(entry);
}

function txn_oncomplete(entry_id, callback, event) {
  log('%s: marked entry as read', db_mark_entry_read.name, entry_id);
  this.channel.postMessage({type: 'entry-marked-read', id: entry_id});
  const conn = event.target.db;
  refresh_badge(conn).catch(log);
  callback();
}
