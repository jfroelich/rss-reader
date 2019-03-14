import {assert} from '/src/assert.js';
import * as indexeddb_utils from '/src/indexeddb-utils/indexeddb-utils.js';
import {Model} from '/src/model/model.js';
import create_entry from '/src/model/ops/create-entry.js';
import get_entry from '/src/model/ops/get-entry.js';
import {Entry, is_entry} from '/src/model/types/entry.js';

export async function create_entry_test() {
  const db_name = 'create-entry-test';
  const model = new Model();
  model.name = db_name;
  await model.open();

  const entry = new Entry();
  const id = await create_entry(model, entry);
  const stored_entry = await get_entry(model, 'id', id, false);
  assert(stored_entry);
  assert(is_entry(stored_entry));
  assert(stored_entry.id === id);
  model.close();
  await indexeddb_utils.remove(db_name);
}
