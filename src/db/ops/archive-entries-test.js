import Entry from '/src/db/entry.js';
import archive_entries from '/src/db/ops/archive-entries.js';
import create_entry from '/src/db/ops/create-entry.js';
import test_open from '/src/db/test-open.js';
import assert from '/src/lib/assert.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';

export async function archive_entries_test() {
  const db_name = 'archive-entries-test';
  await indexeddb_utils.remove(db_name);

  const conn = await test_open(db_name);

  // Create some archivable entries. Rely on create-entry to impute created-date
  // as the time of creation right now. Also rely on create-entry to initialize
  // the archive state as unarchived.

  // We want to test multiple entries to exercise the internal cursor iteration
  // done by archive-entries, so a number like 5 should be enough.

  // archive-entries warns when increasing estimated storage size. we want
  // to avoid this warning by making the input entry larger than the output. we
  // do this by pretending entries had large content.
  let content = '';
  for (let i = 0; i < 100; i++) {
    content += 'lorem ipsum ';
  }

  const create_promises = [];
  for (let i = 0; i < 5; i++) {
    const entry = new Entry();
    entry.title = 'title' + 5;
    entry.content = content;

    // archive-entries only iterates over entries that are unarchived and read.
    // archive-state will be initialized within create-entry to unarchived, and
    // read-state will be initialized to unread. Override the initial
    // read-state as read so that these entries are iterated later.
    entry.read_state = Entry.READ;

    create_promises.push(create_entry(conn, entry));
  }

  const entry_ids = await Promise.all(create_promises);

  // We plan to archive entries older than 1 millisecond based on the difference
  // between entry.created-date and now, so sleep for a while, at least long
  // enough that all entries would be considered archivable
  await new Promise(resolve => setTimeout(resolve, 50));

  // specify a maximum age of 1 millisecond
  const max_age = 1;

  // Exercise the operation. Any error is a test failure.
  const first_pass_ids = await archive_entries(conn, max_age);

  // Now validate the state of the database after the archive has run.

  // Because all entries we created are archivable, should have yielded proper
  // number of ids
  assert(first_pass_ids.length === 5);


  const all_entries = await new Promise((resolve, reject) => {
    const transaction = conn.conn.transaction('entries');
    const store = transaction.objectStore('entries');
    const request = store.getAll();
    request.onsuccess = event => resolve(request.result);
    request.onerror = event => reject(request.error);
  });

  assert(all_entries.length === 5);

  for (const entry of all_entries) {
    assert(entry_ids.includes(entry.id));
    assert(entry.archive_state === Entry.ARCHIVED);
    assert(entry.content === undefined);
    assert(entry.archived_date instanceof Date);
  }

  // No additional entries should be archived
  const second_pass_ids = await archive_entries(conn, max_age);
  assert(second_pass_ids.length === 0);

  conn.close();
  await indexeddb_utils.remove(db_name);
}
