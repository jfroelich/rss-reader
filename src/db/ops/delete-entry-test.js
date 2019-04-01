import create_entry from '/src/db/ops/create-entry.js';
import delete_entry from '/src/db/ops/delete-entry.js';
import get_entry from '/src/db/ops/get-entry.js';
import * as resource_utils from '/src/db/resource-utils.js';
import test_open from '/src/db/test-open.js';
import assert from '/src/lib/assert.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';

export async function delete_entry_test() {
  const db_name = 'delete-entry-test';
  await indexeddb_utils.remove(db_name);

  const conn = await test_open(db_name);

  const entry1 = {};
  const url1 = new URL('https://www.example1.com');
  resource_utils.set_url(entry1, url1);
  const entry_id1 = await create_entry(conn, entry1);

  const entry2 = {};
  const url2 = new URL('https://www.example2.com');
  resource_utils.set_url(entry2, url2);
  const entry_id2 = await create_entry(conn, entry2);

  let stored_entry = await get_entry(conn, 'id', entry_id1, false);
  assert(stored_entry);

  await delete_entry(conn, entry_id1, 'test');

  stored_entry = undefined;
  stored_entry = await get_entry(conn, 'id', entry_id1, false);
  assert(!stored_entry);

  stored_entry = undefined;
  stored_entry = await get_entry(conn, 'id', entry_id2, false);
  assert(stored_entry);

  conn.close();
  await indexeddb_utils.remove(db_name);
}
