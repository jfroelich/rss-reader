import {create_entry, ENTRY_STATE_ARCHIVED, ENTRY_STATE_READ, ENTRY_STATE_UNARCHIVED, is_entry} from '/src/entry.js';
import {sizeof} from '/src/lib/lang/sizeof.js';
import {warn} from '/src/log.js';

// TODO: drop the db prefix, the name is a concern of an importing module and
// not a concern of the exporting module, and the prefix is an overqualification

const TWO_DAYS_MS = 1000 * 60 * 60 * 24 * 2;

// Compacts older read entries in the database. Dispatches entry-archived
// messages once the internal transaction completes.
// @param conn {IDBDatabase} an open database connection to the reader
// database
// @param channel {BroadcastChannel} an open channel to which to post
// messages
// @param max_age {Number} in ms, optional, defaults to two days, how old an
// entry must be based on the difference between the run time and the date the
// entry was created in order to consider the entry as archivable
// @throws {TypeError} invalid parameters
// @throws {DOMException} database errors
// @throws {InvalidStateError} occurs when the channel is closed at the time
// messages are sent to the channel, note the transaction still committed
// @return {Promise} resolves to undefined
// TODO: eventually load only only those entries that are archivable by also
// considering entry dates
export function db_archive_entries(conn, channel, max_age = TWO_DAYS_MS) {
  return new Promise(executor.bind(null, conn, channel, max_age));
}

function executor(conn, channel, max_age, resolve, reject) {
  const entry_ids = [];  // track archived to keep around until txn completes
  const txn = conn.transaction('entry', 'readwrite');
  txn.onerror = _ => reject(txn.error);
  txn.oncomplete = txn_oncomplete.bind(null, channel, entry_ids, resolve);

  const store = txn.objectStore('entry');
  const index = store.index('archiveState-readState');
  const key_path = [ENTRY_STATE_UNARCHIVED, ENTRY_STATE_READ];
  const request = index.openCursor(key_path);
  request.onsuccess = request_onsuccess.bind(null, entry_ids, max_age);
}

// Process one entry loaded from db
function request_onsuccess(entry_ids, max_age, event) {
  const cursor = event.target.result;
  if (!cursor) {
    return;
  }

  const entry = cursor.value;
  if (!is_entry(entry)) {
    warn('%s: bad entry read from db', db_archive_entries.name, entry);
    cursor.continue();
    return;
  }

  if (!entry.dateCreated) {
    warn('%s: entry missing date created', db_archive_entries.name, entry);
    cursor.continue();
    return;
  }

  const current_date = new Date();
  const age = current_date - entry.dateCreated;

  if (age < 0) {
    warn('%s: entry created in future', db_archive_entries.name, entry);
    cursor.continue();
    return;
  }

  if (age > max_age) {
    const ae = archive_entry(entry);
    cursor.update(ae);
    entry_ids.push(ae.id);
  }

  cursor.continue();
}

function txn_oncomplete(channel, entry_ids, callback, event) {
  const msg = {type: 'entry-archived', id: 0};
  for (const id of entry_ids) {
    msg.id = id;
    channel.postMessage(msg);
  }

  callback();
}

function archive_entry(entry) {
  const before_size = sizeof(entry);
  const ce = compact_entry(entry);
  const after_size = sizeof(ce);

  if (after_size > before_size) {
    warn('%s: increased size', db_archive_entries.name, entry);
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
