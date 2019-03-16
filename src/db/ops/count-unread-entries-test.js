import {assert} from '/src/assert.js';
import count_unread_entries from '/src/db/ops/count-unread-entries.js';
import create_entry from '/src/db/ops/create-entry.js';
import db_open from '/src/db/ops/db-open.js';
import {Entry} from '/src/db/types/entry.js';
import * as indexeddb_utils from '/src/indexeddb-utils/indexeddb-utils.js';

export async function count_unread_entries_test() {
  const db_name = 'count-unread-entries-test';
  await indexeddb_utils.remove(db_name);

  const conn = await db_open(db_name);

  let count = await count_unread_entries(conn);
  assert(0 === count);

  const insert_unread_count = 3;
  const entries_to_insert = [];
  for (let i = 0; i < insert_unread_count; i++) {
    const entry = new Entry();
    entry.readState = Entry.UNREAD;
    entry.appendURL(new URL('a://b.c' + i));
    entries_to_insert.push(entry);
  }

  const insert_read_count = 5;
  for (let i = 0; i < insert_read_count; i++) {
    const entry = new Entry();
    entry.readState = Entry.READ;
    entry.appendURL(new URL('d://e.f' + i));
    entries_to_insert.push(entry);
  }

  const insert_promises = [];
  for (const entry of entries_to_insert) {
    insert_promises.push(create_entry(conn, undefined, entry));
  }
  await Promise.all(insert_promises);

  // Assert the count of unread entries is equal to the number of inserted
  // unread entries.
  count = await count_unread_entries(conn);
  assert(count === insert_unread_count);

  conn.close();
  await indexeddb_utils.remove(db_name);
}
