import assert from '/src/assert.js';
import {create_entry} from '/src/db/create-entry.js';
import * as entry_utils from '/src/db/entry-utils.js';
import {get_entry} from '/src/db/get-entry.js';
import {open} from '/src/db/open.js';
import {remove} from '/src/db/remove.js';
import * as types from '/src/db/types.js';

export async function create_entry_test() {
  // Test setup
  const db_name = 'create-entry-test';
  const session = await open(db_name);

  // Create and store an entry in the database. Grab its generated id.
  const entry = entry_utils.create_entry_object();
  const id = await create_entry(session, entry);

  // Load the entry from the database corresponding to the generated id and
  // verify the state of its properties
  const stored_entry = await get_entry(session, 'id', id, false);

  // We should have matched an object
  assert(stored_entry);

  // The object type should not be corrupted
  assert(types.is_entry(stored_entry));

  // The object ids should match
  assert(stored_entry.id === id);

  // Test teardown
  session.close();
  await remove(db_name);
}
