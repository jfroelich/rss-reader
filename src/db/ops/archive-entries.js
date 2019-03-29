import Entry from '/src/db/entry.js';
import assert from '/src/lib/assert.js';
import sizeof from '/src/lib/sizeof.js';
import {is_entry} from '/src/db/types.js';
import Connection from '/src/db/connection.js';
import filter_empty_properties from '/src/lib/filter-empty-properties.js';

const TWO_DAYS_MS = 1000 * 60 * 60 * 24 * 2;

export default function archive_entries(conn, max_age = TWO_DAYS_MS) {
  return new Promise((resolve, reject) => {
    assert(conn instanceof Connection);
    assert(max_age >= 0);

    const ids = [];
    const transaction = conn.conn.transaction('entries', 'readwrite');
    transaction.oncomplete =
        transaction_oncomplete.bind(transaction, conn.channel, ids, resolve);
    transaction.onerror = event => reject(event.target.error);

    const request = create_archivable_entries_cursor_request(transaction);
    request.onsuccess = request_onsuccess.bind(request, ids, max_age);
  });
}

function create_archivable_entries_cursor_request(transaction) {
  const store = transaction.objectStore('entries');
  const index = store.index('archive_state-read_state');
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

  if (!entry.created_date) {
    console.warn('Skiping entry missing date created', entry);
    cursor.continue();
    return;
  }

  const current_date = new Date();
  const age = current_date - entry.created_date;

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
  ce.created_date = entry.created_date;
  ce.published_date = entry.published_date;

  if (entry.read_date) {
    ce.read_date = entry.read_date;
  }

  ce.feed = entry.feed;
  ce.id = entry.id;
  ce.read_state = entry.read_state;
  ce.urls = entry.urls;

  // We do not measure all fields
  const after_size = sizeof(ce);
  if (after_size > before_size) {
    const delta = after_size - before_size;
    console.warn(
        'Archiving entry increased size by %d, before %o, after %o', delta,
        entry, ce);
  }

  ce.archive_state = Entry.ARCHIVED;
  const current_date = new Date();
  ce.archived_date = current_date;
  ce.updated_date = current_date;

  // ce is a new entry that we are writing directly back into the database. the
  // new entry constructor will initialize default properties, but some of them
  // we do not need, so we strip them again
  filter_empty_properties(ce);

  return ce;
}
