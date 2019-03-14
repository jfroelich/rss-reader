import {assert} from '/src/assert.js';
import * as indexeddb_utils from '/src/indexeddb-utils/indexeddb-utils.js';
import {Model} from '/src/model/model.js';
import count_unread_entries from '/src/model/ops/count-unread-entries.js';
import create_entry from '/src/model/ops/create-entry.js';
import {Entry} from '/src/model/types/entry.js';

export async function count_unread_entries_test() {
  const db_name = 'count-unread-entries-test';
  await indexeddb_utils.remove(db_name);

  const model = new Model();
  model.name = db_name;
  await model.open();

  let count = await count_unread_entries(model);
  assert(0 === count);

  // Generate some unread entries
  const insert_unread_count = 3;
  const entries_to_insert = [];
  for (let i = 0; i < insert_unread_count; i++) {
    const entry = new Entry();
    entry.readState = Entry.UNREAD;
    entry.appendURL(new URL('a://b.c' + i));
    entries_to_insert.push(entry);
  }

  // Generate some read entries
  const insert_read_count = 5;
  for (let i = 0; i < insert_read_count; i++) {
    const entry = new Entry();
    entry.readState = Entry.READ;
    entry.appendURL(new URL('d://e.f' + i));
    entries_to_insert.push(entry);
  }

  // Store both the read and unread entries
  const insert_promises = [];
  for (const entry of entries_to_insert) {
    insert_promises.push(create_entry(model, entry));
  }
  await Promise.all(insert_promises);

  // Assert the count of unread entries is equal to the number of inserted
  // unread entries.
  count = await count_unread_entries(model);
  assert(count === insert_unread_count);

  model.close();
  await indexeddb_utils.remove(db_name);
}
