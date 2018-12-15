import assert from '/src/assert.js';

import {create_entry} from './create-entry.js';
import * as entry_utils from './entry-utils.js';
import {get_entries} from './get-entries.js';
import {open} from './open.js';
import {remove} from './remove.js';

export async function get_entries_test() {
  // Test setup
  const db_name = 'get-entries-test';
  await remove(db_name);
  const session = await open(db_name);

  // Number of entries for testing. Note this should be greater than one
  // because some later logic may assume that at least one entry exists.
  const n = 5;

  // Insert n entries
  const create_promises = [];
  for (let i = 0; i < n; i++) {
    const entry = entry_utils.create_entry_object();
    entry.title = 'title ' + i;
    const promise = create_entry(session, entry);
    create_promises.push(promise);
  }
  await Promise.all(create_promises);

  // Get all entries in the database
  const get_all_offset = 0;
  const get_all_limit = 0;
  const entries =
      await get_entries(session, 'all', get_all_offset, get_all_limit);

  // We should have loaded n many entries
  assert(entries.length === n);


  // Test teardown
  session.close();
  await remove(db_name);
}
