import * as locatable from '/src/db/locatable.js';
import Entry from '/src/db/object/entry.js';
import create_entry from '/src/db/ops/create-entry.js';
import delete_entry from '/src/db/ops/delete-entry.js';
import get_entry from '/src/db/ops/get-entry.js';
import db_open from '/src/db/ops/open.js';
import assert from '/src/lib/assert.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';

export async function delete_entry_test() {
  const db_name = 'delete-entry-test';
  await indexeddb_utils.remove(db_name);

  const conn = await db_open(db_name);

  const entry1 = new Entry();
  const url1 = new URL('https://www.example1.com');
  locatable.append_url(entry1, url1);
  const entry_id1 = await create_entry(conn, undefined, entry1);

  const entry2 = new Entry();
  const url2 = new URL('https://www.example2.com');
  locatable.append_url(entry2, url2);
  const entry_id2 = await create_entry(conn, undefined, entry2);

  let stored_entry = await get_entry(conn, 'id', entry_id1, false);
  assert(stored_entry);

  await delete_entry(conn, undefined, entry_id1, 'test');

  stored_entry = undefined;
  stored_entry = await get_entry(conn, 'id', entry_id1, false);
  assert(!stored_entry);

  stored_entry = undefined;
  stored_entry = await get_entry(conn, 'id', entry_id2, false);
  assert(stored_entry);

  conn.close();
  await indexeddb_utils.remove(db_name);
}
