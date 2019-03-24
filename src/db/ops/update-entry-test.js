import Entry from '/src/db/entry.js';
import create_entry from '/src/db/ops/create-entry.js';
import get_entry from '/src/db/ops/get-entry.js';
import update_entry from '/src/db/ops/update-entry.js';
import test_open from '/src/db/test-open.js';
import assert from '/src/lib/assert.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';

export async function update_entry_test() {
  const db_name = 'update-entry-test';
  await indexeddb_utils.remove(db_name);

  const conn = await test_open(db_name);

  let entry = new Entry();
  entry.title = 'first-title';
  const entry_id = await create_entry(conn, entry);
  entry = await get_entry(conn, 'id', entry_id, false);
  entry.title = 'second-title';
  await update_entry(conn, entry);
  entry = await get_entry(conn, 'id', entry_id, false);
  assert(entry.title === 'second-title');

  conn.close();
  await indexeddb_utils.remove(db_name);
}
