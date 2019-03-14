import {assert} from '/src/assert.js';
import db_open from '/src/db/ops/db-open.js';
import create_entry from '/src/db/ops/create-entry.js';
import get_entry from '/src/db/ops/get-entry.js';
import {Entry, is_entry} from '/src/db/types/entry.js';
import * as indexeddb_utils from '/src/indexeddb-utils/indexeddb-utils.js';

export async function create_entry_test() {
  const db_name = 'create-entry-test';
  await indexeddb_utils.remove(db_name);

  const conn = await db_open(db_name);

  const entry = new Entry();
  const id = await create_entry(conn, undefined, entry);
  const stored_entry = await get_entry(conn, 'id', id, false);
  assert(stored_entry);
  assert(is_entry(stored_entry));
  assert(stored_entry.id === id);

  conn.close();
  await indexeddb_utils.remove(db_name);
}
