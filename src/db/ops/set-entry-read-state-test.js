import {assert} from '/src/assert.js';
import db_open from '/src/db/ops/db-open.js';
import create_entry from '/src/db/ops/create-entry.js';
import get_entry from '/src/db/ops/get-entry.js';
import set_entry_read_state from '/src/db/ops/set-entry-read-state.js';
import {Entry} from '/src/db/types/entry.js';
import * as indexeddb_utils from '/src/indexeddb-utils/indexeddb-utils.js';

export async function set_entry_read_state_test() {
  const db_name = set_entry_read_state_test.name;
  await indexeddb_utils.remove(db_name);

  const conn = await db_open(db_name);

  const entry = new Entry();
  entry.readState = Entry.UNREAD;
  const id = await create_entry(conn, undefined, entry);
  let stored_entry = await get_entry(conn, 'id', id, false);
  assert(stored_entry);
  assert(stored_entry.readState === Entry.UNREAD);
  await set_entry_read_state(conn, undefined, id, true);
  stored_entry = undefined;
  stored_entry = await get_entry(conn, 'id', id, false);
  assert(stored_entry);
  assert(stored_entry.readState === Entry.READ);

  // Now mark it again as unread, and assert
  await set_entry_read_state(conn, undefined, id, false);
  stored_entry = undefined;
  stored_entry = await get_entry(conn, 'id', id, false);
  assert(stored_entry);
  assert(stored_entry.readState === Entry.UNREAD);

  conn.close();
  await indexeddb_utils.remove(db_name);
}
