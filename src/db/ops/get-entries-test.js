import create_entry from '/src/db/ops/create-entry.js';
import get_entries from '/src/db/ops/get-entries.js';
import test_open from '/src/db/test-open.js';
import assert from '/src/lib/assert.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';

export async function get_entries_test() {
  const db_name = 'get-entries-test';
  await indexeddb_utils.remove(db_name);

  const conn = await test_open(db_name);

  const n = 5;
  const create_promises = [];
  for (let i = 0; i < n; i++) {
    const entry = {};
    entry.title = 'title ' + i;
    create_promises.push(create_entry(conn, entry));
  }
  await Promise.all(create_promises);
  const entries = await get_entries(conn, 'all', 0, 0);
  assert(entries.length === n);

  conn.close();
  await indexeddb_utils.remove(db_name);
}
