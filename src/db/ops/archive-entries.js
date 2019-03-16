import {assert} from '/src/assert.js';
import {Entry, is_entry} from '/src/db/types/entry.js';
import sizeof from '/src/db/utils/sizeof.js';

const TWO_DAYS_MS = 1000 * 60 * 60 * 24 * 2;

export default function archive_entries(conn, channel, max_age = TWO_DAYS_MS) {
  return new Promise((resolve, reject) => {
    assert(conn instanceof IDBDatabase);
    assert(max_age >= 0);

    const ids = [];
    const transaction = conn.transaction('entry', 'readwrite');
    transaction.oncomplete =
        transaction_oncomplete.bind(transaction, channel, ids, resolve);
    transaction.onerror = event => reject(event.target.error);

    const request = create_archivable_entries_cursor_request(transaction);
    request.onsuccess = request_onsuccess.bind(request, ids, max_age);
  });
}

function create_archivable_entries_cursor_request(transaction) {
  const store = transaction.objectStore('entry');
  const index = store.index('archiveState-readState');
  const key_path = [Entry.UNARCHIVED, Entry.READ];
  return index.openCursor(key_path);
}

function request_onsuccess(ids, max_age, event) {
  const cursor = event.target.result;
  if (!cursor) {
    return;
  }

  const entry = cursor.value;
  if (!is_entry(entry)) {
    console.warn('Skipping non-entry object', entry);
    cursor.continue();
    return;
  }

  if (!entry.dateCreated) {
    console.warn('Skiping entry missing date created', entry);
    cursor.continue();
    return;
  }

  const current_date = new Date();
  const age = current_date - entry.dateCreated;

  if (age < 0) {
    console.warn('Skipping entry created in the future', entry);
    cursor.continue();
    return;
  }

  if (age > max_age) {
    const archived_entry = archive_entry(entry);
    cursor.update(archived_entry);
    ids.push(archived_entry.id);
  }

  cursor.continue();
}

function transaction_oncomplete(channel, ids, callback, event) {
  if (channel) {
    for (const id of ids) {
      channel.postMessage({type: 'entry-archived', id: id});
    }
  }

  callback(ids);
}

function archive_entry(entry) {
  const before_size = sizeof(entry);

  const ce = new Entry();
  ce.dateCreated = entry.dateCreated;
  ce.datePublished = entry.datePublished;
  if (!ce.datePublished) {
    ce.datePublished = ce.dateCreated;
  }

  if (entry.dateRead) {
    ce.dateRead = entry.dateRead;
  }

  ce.feed = entry.feed;
  ce.id = entry.id;
  ce.readState = entry.readState;
  ce.urls = entry.urls;

  // We do not measure all fields
  const after_size = sizeof(ce);
  if (after_size > before_size) {
    console.warn(
        'Archiving entry increased size by %d', after_size - before_size, entry,
        ce);
  }

  ce.archiveState = Entry.ARCHIVED;
  const current_date = new Date();
  ce.dateArchived = current_date;
  ce.dateUpdated = current_date;
  return ce;
}
