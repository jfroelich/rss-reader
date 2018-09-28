import assert from '/src/assert/assert.js';
import assert from '/src/assert/assert.js';
import * as entry_utils from '/src/db/entry-utils.js';
import * as idbmodel from '/src/db/idb-model.js';
import {count_unread_entries} from '/src/db/op/count-unread-entries.js';
import * as indexeddb from '/src/indexeddb/indexeddb.js';

async function count_unread_entries_test() {
  const conn = await idbmodel.open('count-unread-entries-test');
  let count = await count_unread_entries(conn);
  assert(count === 0);

  const insert_unread_count = 3;
  const entries_to_insert = [];
  for (let i = 0; i < insert_unread_count; i++) {
    const entry = entry_utils.create_entry();
    entry.readState = entry_utils.ENTRY_STATE_UNREAD;
    entry_utils.append_entry_url(entry, new URL('a://b.c' + i));
    entries_to_insert.push(entry);
  }

  const insert_read_count = 5;
  for (let i = 0; i < insert_read_count; i++) {
    const entry = entry_utils.create_entry();
    entry.readState = entry_utils.ENTRY_STATE_READ;
    entry_utils.append_entry_url(entry, new URL('d://e.f' + i));
    entries_to_insert.push(entry);
  }

  const insert_promises = [];
  for (const entry of entries_to_insert) {
    const promise = idbmodel.create_entry(conn, entry);
    insert_promises.push(promise);
  }
  await Promise.all(insert_promises);

  count = await count_unread_entries(conn);
  assert(count === insert_unread_count);

  conn.close();
  await indexeddb.remove(conn.name);
}

register_test(count_unread_entries_test);
