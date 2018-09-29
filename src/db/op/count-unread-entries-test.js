import assert from '/src/assert/assert.js';
import * as db from '/src/db/db.js';
import * as entry_utils from '/src/db/entry-utils.js';
import {count_unread_entries} from '/src/db/op/count-unread-entries.js';
import {create_entry} from '/src/db/op/create-entry.js';

async function count_unread_entries_test() {
  // Test setup
  const db_name = 'count-unread-entries-test';
  const session = await db.open(db_name);

  // Assert that the count of an empty database is in fact 0
  let count = await count_unread_entries(session.conn);
  assert(count === 0);

  // Generate some unread entries
  const insert_unread_count = 3;
  const entries_to_insert = [];
  for (let i = 0; i < insert_unread_count; i++) {
    const entry = entry_utils.create_entry();
    entry.readState = entry_utils.ENTRY_STATE_UNREAD;
    entry_utils.append_entry_url(entry, new URL('a://b.c' + i));
    entries_to_insert.push(entry);
  }

  // Generate some read entries
  const insert_read_count = 5;
  for (let i = 0; i < insert_read_count; i++) {
    const entry = entry_utils.create_entry();
    entry.readState = entry_utils.ENTRY_STATE_READ;
    entry_utils.append_entry_url(entry, new URL('d://e.f' + i));
    entries_to_insert.push(entry);
  }

  // Store both the read and unread entries
  const insert_promises = [];
  for (const entry of entries_to_insert) {
    const promise = create_entry(session.conn, session.channel, entry);
    insert_promises.push(promise);
  }
  await Promise.all(insert_promises);

  // Assert the count of unread entries is equal to the number of inserted
  // unread entries.
  count = await count_unread_entries(session.conn);
  assert(count === insert_unread_count);

  // Test teardown
  session.close();
  await db.remove(db_name);
}

register_test(count_unread_entries_test);
