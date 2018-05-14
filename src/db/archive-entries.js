import {create_entry, ENTRY_STATE_ARCHIVED, ENTRY_STATE_READ, ENTRY_STATE_UNARCHIVED} from '/src/db/entry.js';
import {sizeof} from '/src/lib/sizeof.js';

const TWO_DAYS_MS = 1000 * 60 * 60 * 24 * 2;

export function archive_entries(max_age = TWO_DAYS_MS) {
  return new Promise(archive_entries_executor.bind(this, max_age));
}

function archive_entries_executor(max_age, resolve, reject) {
  this.console.log('%s: starting', archive_entries.name);
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

// TODO: check that loaded entry is_entry
// TODO: use early returns, less nesting
function request_onsuccess(entry_ids, max_age, event) {
  const cursor = event.target.result;
  if (cursor) {
    const entry = cursor.value;
    if (entry.dateCreated) {
      const current_date = new Date();
      const age = current_date - entry.dateCreated;
      if (age > max_age) {
        const ae = archive_entry(this.console, entry);
        cursor.update(ae);
        entry_ids.push(ae.id);
      }
    }

    cursor.continue();
  }
}

function txn_oncomplete(entry_ids, callback, event) {
  this.console.debug(
      '%s: archived %d entries', archive_entries.name, entry_ids.length);

  const channel = this.channel;
  const msg = {type: 'entry-archived', id: 0};
  for (const id of entry_ids) {
    msg.id = id;
    channel.postMessage(msg);
  }

  callback(entry_ids);
}

function archive_entry(console, entry) {
  const before_sz = sizeof(entry);
  const ce = compact_entry(entry);
  const after_sz = sizeof(ce);

  if (after_sz > before_sz) {
    console.warn('%s: increased entry size %o', archive_entries.name, entry);
  }

  console.debug(
      '%s: reduced entry size by ~%d bytes', archive_entries.name,
      after_sz - before_sz);
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
