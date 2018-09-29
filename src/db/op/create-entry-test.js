import assert from '/src/assert/assert.js';
import * as entry_utils from '/src/db/entry-utils.js';
import * as idbmodel from '/src/db/idb-model.js';
import {create_entry} from '/src/db/op/create-entry.js';
import {get_entry} from '/src/db/op/get-entry.js';
import * as types from '/src/db/types.js';
import * as indexeddb from '/src/indexeddb/indexeddb.js';
import {register_test} from '/test/test-registry.js';

async function create_entry_test() {
  const conn = await idbmodel.open('create-entry-test');
  const entry = entry_utils.create_entry();
  const id = await create_entry(conn, undefined, entry);
  const stored_entry = await get_entry(conn, 'id', id, false);

  assert(stored_entry);
  assert(types.is_entry(stored_entry));
  assert(stored_entry.id === id);

  conn.close();
  await indexeddb.remove(conn.name);
}

register_test(create_entry_test);
