import create_entry from '/src/db/ops/create-entry.js';
import get_entry from '/src/db/ops/get-entry.js';
import patch_entry from '/src/db/ops/patch-entry.js';
import test_open from '/src/db/test-open.js';
import assert from '/src/lib/assert.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';

export default async function patch_entry_test() {
  const database_name = 'patch-entry-test';
  await indexeddb_utils.remove(database_name);

  const conn = await test_open(database_name);

  // Setup a test entry to work with and store it
  let entry = {};
  entry.read_state = 0;
  const entry_id = await create_entry(conn, entry);

  // Verify the entry is really unread as a precondition
  entry = await get_entry(conn, 'id', entry_id);
  assert(entry.read_state === 0);

  // Exercise the tested operation. In this case, patch the entry by marking it
  // as read.
  const delta = {id: entry_id, read_state: 1};
  await patch_entry(conn, delta);

  // Read the entry from the database
  entry = await get_entry(conn, 'id', entry_id);

  // Verify the entry entered into the expected state
  assert(entry.read_state === 1);

  conn.close();
  await indexeddb_utils.remove(database_name);
}
