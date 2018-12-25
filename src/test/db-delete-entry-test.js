import assert from '/src/assert.js';
import {create_entry} from '/src/db/create-entry.js';
import {delete_entry} from '/src/db/delete-entry.js';
import * as entry_utils from '/src/db/entry-utils.js';
import {get_entry} from '/src/db/get-entry.js';
import {open} from '/src/db/open.js';
import {remove} from '/src/db/remove.js';

export async function delete_entry_test() {
  const db_name = 'delete-entry-test';
  await remove(db_name);
  const session = await open(db_name);

  const entry = entry_utils.create_entry_object();
  const url = new URL('https://www.example.com');
  entry_utils.append_entry_url(entry, url);

  const entry2 = entry_utils.create_entry_object();
  const url2 = new URL('https://www.example2.com');
  entry_utils.append_entry_url(entry2, url2);

  const entry_id = await create_entry(session, entry);
  const entry_id2 = await create_entry(session, entry2);

  let stored_entry = await get_entry(session, 'id', entry_id, false);

  // We are not testing create/get. We are just asserting a precondition to
  // testing delete-entry. This confirms the entry exists.
  assert(stored_entry);

  await delete_entry(session, entry_id, 'test');

  stored_entry = undefined;
  stored_entry = await get_entry(session, 'id', entry_id, false);

  // We expect not to find it once it is deleted
  assert(!stored_entry);

  stored_entry = undefined;
  stored_entry = await get_entry(session, 'id', entry_id2, false);

  // We should still be able to find the second entry after deleting the first
  assert(stored_entry);

  session.close();
  await remove(db_name);
}
