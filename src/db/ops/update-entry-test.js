import {assert} from '/src/assert.js';
import create_entry from '/src/db/ops/create-entry.js';
import db_open from '/src/db/ops/db-open.js';
import get_entry from '/src/db/ops/get-entry.js';
import update_entry from '/src/db/ops/update-entry.js';
import {Entry} from '/src/db/types/entry.js';
import * as indexeddb_utils from '/src/indexeddb-utils/indexeddb-utils.js';

export async function update_entry_test() {
  const db_name = 'update-entry-test';
  await indexeddb_utils.remove(db_name);

  const conn = await db_open(db_name);

  let entry = new Entry();
  entry.title = 'first-title';
  const entry_id = await create_entry(conn, undefined, entry);
  entry = await get_entry(conn, 'id', entry_id, false);
  entry.title = 'second-title';
  await update_entry(conn, undefined, entry);
  entry = await get_entry(conn, 'id', entry_id, false);
  assert(entry.title === 'second-title');

  conn.close();
  await indexeddb_utils.remove(db_name);
}
