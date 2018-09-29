import * as entry_utils from '/src/db/entry-utils.js';
import * as types from '/src/db/types.js';
import sizeof from '/src/db/sizeof.js';

const TWO_DAYS_MS = 1000 * 60 * 60 * 24 * 2;

export async function archive_entries(session, max_age = TWO_DAYS_MS) {
  const ids = await archive_entries_internal(session.conn, max_age);
  if (session.channel) {
    for (const id of ids) {
      const message = {type: 'entry-archived', id: id};
      session.channel.postMessage(message);
    }
  }
}

function archive_entries_internal(conn, max_age) {
  return new Promise(archive_entries_executor.bind(null, conn, max_age));
}

function archive_entries_executor(conn, max_age, resolve, reject) {
  const entry_ids = [];
  const txn = conn.transaction('entry', 'readwrite');
  txn.oncomplete = _ => resolve(entry_ids);
  txn.onerror = event => reject(event.target.error);

  const store = txn.objectStore('entry');
  const index = store.index('archiveState-readState');
  const key_path =
      [entry_utils.ENTRY_STATE_UNARCHIVED, entry_utils.ENTRY_STATE_READ];
  const request = index.openCursor(key_path);

  // TODO: do not nest, increase readability
  request.onsuccess = event => {
    const cursor = event.target.result;
    if (!cursor) {
      return;
    }

    const entry = cursor.value;
    if (!types.is_entry(entry)) {
      console.warn('Not an entry', entry);
      cursor.continue();
      return;
    }

    if (!entry.dateCreated) {
      console.warn('No date created', entry);
      cursor.continue();
      return;
    }

    const current_date = new Date();
    const age = current_date - entry.dateCreated;

    if (age < 0) {
      console.warn('Future entry', entry);
      cursor.continue();
      return;
    }

    if (age > max_age) {
      const ae = archive_entry(entry);
      cursor.update(ae);
      entry_ids.push(ae.id);
    }

    cursor.continue();
  };
}

function archive_entry(entry) {
  const before_size = sizeof(entry);
  const ce = compact_entry(entry);
  const after_size = sizeof(ce);

  if (after_size > before_size) {
    console.warn('Entry increased size', entry);
  }

  ce.archiveState = entry_utils.ENTRY_STATE_ARCHIVED;
  const current_date = new Date();
  ce.dateArchived = current_date;
  ce.dateUpdated = current_date;
  return ce;
}

function compact_entry(entry) {
  const ce = entry_utils.create_entry();
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
