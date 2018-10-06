import assert from '/src/assert/assert.js';

import {create_entry} from './create-entry.js';
import * as entry_utils from './entry-utils.js';
import {get_entry} from './get-entry.js';
import {open} from './open.js';
import {remove} from './remove.js';

export async function get_entry_test() {
  const db_name = 'get-entry-test';
  await remove(db_name);
  const session = await open(db_name);

  // Create an entry
  const entry = entry_utils.create_entry_object();
  entry.title = 'test';
  const entry_id = await create_entry(session, entry);

  const mode_id = 'id';
  const key_only = false;

  // Exercise get entry
  const stored_entry = await get_entry(session, mode_id, entry_id, key_only);

  // We should have found the entry
  assert(stored_entry);

  // Getting an entry that does not exist should not cause an error.
  const non_existing_entry_id = 123456789;
  const non_existing_entry =
      await get_entry(session, mode_id, non_existing_entry_id, key_only);
  // Getting an entry that does not exist should return undefined.
  assert(non_existing_entry === undefined);

  session.close();
  await remove(db_name);
}
