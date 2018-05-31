import {create_entry, ENTRY_STATE_ARCHIVED, ENTRY_STATE_READ, ENTRY_STATE_UNARCHIVED, is_entry} from '/src/entry.js';
import {sizeof} from '/src/lib/lang/sizeof.js';
import {log} from '/src/log.js';

const TWO_DAYS_MS = 1000 * 60 * 60 * 24 * 2;

// Archives certain older entries in the database. Archiving reduces storage
// size. This scans the database using a single transaction. Once the
// transaction resolves, this dispatches a message for each entry archived to
// the given channel.
// @context-param conn {IDBDatabase} an open database connection to the reader
// database
// @context-param channel {BroadcastChannel} an open channel to which to post
// messages
// @param max_age {Number} in milliseconds, optional, defaults to two days, how
// old an entry must be based on the difference between the run time and the
// date the entry was created in order to consider the entry as archivable
// @throws {TypeError} invalid inputs, such as invalid max-age parameter value
// @throws {DOMException} database errors such as database not open, database
// close pending, transaction failure, store missing
// @throws {InvalidStateError} occurs when the channel is closed at the time
// messages are sent to the channel, note that this error does not indicate that
// the internal transaction failed to commit because it occurs after the commit
// @return {Promise} resolves to undefined
export function db_archive_entries(max_age = TWO_DAYS_MS) {
  return new Promise(archive_entries_executor.bind(this, max_age));
}

// At the moment, this loads more entries than needed due to some query
// complexity. For now the perf loss is acceptable given this is typically a
// background op. This uses a cursor (vs getAll) for scalability.
function archive_entries_executor(max_age, resolve, reject) {
  log('%s: starting', db_archive_entries.name);
  const entry_ids = [];
  const txn = this.conn.transaction('entry', 'readwrite');
  txn.onerror = _ => reject(txn.error);
  txn.oncomplete = txn_oncomplete.bind(this, entry_ids, resolve);

  const store = txn.objectStore('entry');
  const index = store.index('archiveState-readState');
  const key_path = [ENTRY_STATE_UNARCHIVED, ENTRY_STATE_READ];
  const request = index.openCursor(key_path);
  request.onsuccess = request_onsuccess.bind(this, entry_ids, max_age);
}

function request_onsuccess(entry_ids, max_age, event) {
  const cursor = event.target.result;
  if (!cursor) {
    return;
  }

  const entry = cursor.value;
  if (is_entry(entry) && entry.dateCreated) {
    const current_date = new Date();
    const age = current_date - entry.dateCreated;
    if (age > max_age) {
      const ae = archive_entry(entry);
      cursor.update(ae);
      entry_ids.push(ae.id);
    }
  }

  cursor.continue();
}

function txn_oncomplete(entry_ids, callback, event) {
  const msg = {type: 'entry-archived', id: 0};
  for (const id of entry_ids) {
    msg.id = id;
    this.channel.postMessage(msg);
  }

  callback();
}

function archive_entry(entry) {
  const before_size = sizeof(entry);
  const ce = compact_entry(entry);
  const after_size = sizeof(ce);

  if (after_size > before_size) {
    log('%s: unexpectedly increased entry size %o', db_archive_entries.name,
        entry);
  }

  ce.archiveState = ENTRY_STATE_ARCHIVED;
  const current_date = new Date();
  ce.dateArchived = current_date;
  ce.dateUpdated = current_date;
  return ce;
}

function compact_entry(entry) {
  const ce = create_entry();
  ce.dateCreated = entry.dateCreated;

  if (entry.dateRead) {
    ce.dateRead = entry.dateRead;
  }

  ce.feed = entry.feed;
  ce.id = entry.id;
  ce.readState = entry.readState;
  ce.urls = entry.urls;
  return ce;
}
