import create_entry from '/src/db/ops/create-entry.js';
import get_entry from '/src/db/ops/get-entry.js';
import test_open from '/src/db/test-open.js';
import assert from '/src/lib/assert.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';

export async function get_entry_test() {
  const db_name = 'get-entry-test';
  await indexeddb_utils.remove(db_name);

  const conn = await test_open(db_name);

  const entry = {};
  entry.title = 'test';
  const entry_id = await create_entry(conn, entry);

  const stored_entry = await get_entry(conn, 'id', entry_id);
  assert(stored_entry);

  const non_existent_id = 123456789;
  const non_existent_entry = await get_entry(conn, 'id', non_existent_id);
  assert(non_existent_entry === undefined);

  conn.close();
  await indexeddb_utils.remove(db_name);
}
