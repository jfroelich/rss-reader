import count_unread_entries from '/src/db/ops/count-unread-entries.js';
import create_entry from '/src/db/ops/create-entry.js';
import * as resource_utils from '/src/db/resource-utils.js';
import test_open from '/src/db/test-open.js';
import assert from '/src/lib/assert.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';

export async function count_unread_entries_test() {
  const db_name = 'count-unread-entries-test';
  await indexeddb_utils.remove(db_name);

  const conn = await test_open(db_name);

  let count = await count_unread_entries(conn);
  assert(0 === count);

  const insert_unread_count = 3;
  const entries_to_insert = [];
  for (let i = 0; i < insert_unread_count; i++) {
    const entry = {};
    entry.read_state = 0;
    resource_utils.set_url(entry, new URL('a://b.c' + i));
    entries_to_insert.push(entry);
  }

  const insert_read_count = 5;
  for (let i = 0; i < insert_read_count; i++) {
    const entry = {};
    entry.read_state = 1;
    resource_utils.set_url(entry, new URL('d://e.f' + i));
    entries_to_insert.push(entry);
  }

  const insert_promises = [];
  for (const entry of entries_to_insert) {
    insert_promises.push(create_entry(conn, entry));
  }
  await Promise.all(insert_promises);

  // Assert the count of unread entries is equal to the number of inserted
  // unread entries.
  count = await count_unread_entries(conn);
  assert(count === insert_unread_count);

  conn.close();
  await indexeddb_utils.remove(db_name);
}
