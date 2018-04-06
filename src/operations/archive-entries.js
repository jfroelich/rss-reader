import {entry_create, ENTRY_STATE_ARCHIVED, ENTRY_STATE_READ, ENTRY_STATE_UNARCHIVED} from '/src/objects/entry.js';
import {sizeof} from '/src/lib/sizeof/sizeof.js';
import {console_stub} from '/src/lib/console-stub/console-stub.js';

const TWO_DAYS_MS = 1000 * 60 * 60 * 24 * 2;

const null_channel = {
  name: 'null-channel',
  postMessage: noop,
  close: noop
};

export function rdr_archive(
    conn, channel = null_channel, console = console_stub,
    max_age = TWO_DAYS_MS) {
  return new Promise(executor.bind(null, conn, channel, max_age, console));
}

function executor(conn, channel, max_age, console, resolve, reject) {
  console.log('Archiving entries...');
  const entry_ids = [];
  const txn = conn.transaction('entry', 'readwrite');
  txn.onerror = _ => reject(txn.error);
  txn.oncomplete =
      txn_oncomplete.bind(txn, channel, console, entry_ids, resolve);
  const store = txn.objectStore('entry');
  const index = store.index('archiveState-readState');
  const key_path = [ENTRY_STATE_UNARCHIVED, ENTRY_STATE_READ];
  const request = index.openCursor(key_path);
  request.onsuccess = handle_cursor.bind(request, console, entry_ids, max_age);
}

function handle_cursor(console, entry_ids, max_age, event) {
  const cursor = event.target.result;
  if (cursor) {
    const entry = cursor.value;
    if (entry.dateCreated) {
      const current_date = new Date();
      const age = current_date - entry.dateCreated;
      if (age > max_age) {
        const ae = archive_entry(console, entry);
        cursor.update(ae);
        entry_ids.push(ae.id);
      }
    }

    cursor.continue();
  }
}

function txn_oncomplete(channel, console, entry_ids, callback, event) {
  for (const id of entry_ids) {
    channel.postMessage({type: 'entry-archived', id: id});
  }

  console.debug('Archived %d entries', entry_ids.length);
  callback(entry_ids);
}

function archive_entry(console, entry) {
  const before_sz = sizeof(entry);
  const ce = compact_entry(entry);
  const after_sz = sizeof(ce);

  if (after_sz > before_sz) {
    console.warn('compact_entry increased entry size!', entry);
  }

  console.debug('Reduced entry size by ~%d bytes', after_sz - before_sz);
  ce.archiveState = ENTRY_STATE_ARCHIVED;
  const current_date = new Date();
  ce.dateArchived = current_date;
  ce.dateUpdated = current_date;
  return ce;
}

function compact_entry(entry) {
  const ce = entry_create();
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

function noop() {}
