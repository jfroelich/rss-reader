import assert from '/src/assert/assert.js';
import * as entry_utils from '/src/db/entry-utils.js';
import {create_entry} from '/src/db/op/create-entry.js';
import {get_entry} from '/src/db/op/get-entry.js';
import * as types from '/src/db/types.js';
import {register_test} from '/src/test/test-registry.js';

async function create_entry_test() {
  // Test setup
  const db_name = 'create-entry-test';
  const session = await db.open(db_name);

  // Create and store an entry in the database. Grab its generated id.
  // TODO: if I impose urls constraint on create-entry then I will need to
  // append a dummy url here
  const entry = entry_utils.create_entry();
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
  await db.remove(db_name);
}

register_test(create_entry_test);
