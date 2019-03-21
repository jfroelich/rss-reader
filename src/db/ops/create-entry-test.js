import Entry from '/src/db/entry.js';
import create_entry from '/src/db/ops/create-entry.js';
import get_entry from '/src/db/ops/get-entry.js';
import db_open from '/src/db/ops/open.js';
import {is_entry} from '/src/db/types.js';
import assert from '/src/lib/assert.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';

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
