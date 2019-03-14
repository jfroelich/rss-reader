import {assert} from '/src/assert.js';
import * as indexeddb_utils from '/src/indexeddb-utils/indexeddb-utils.js';
import {Model} from '/src/model/model.js';
import create_entry from '/src/model/ops/create-entry.js';
import get_entry from '/src/model/ops/get-entry.js';
import {Entry} from '/src/model/types/entry.js';

export async function get_entry_test() {
  const db_name = 'get-entry-test';
  await indexeddb_utils.remove(db_name);

  const model = new Model();
  model.name = db_name;
  await model.open();

  const entry = new Entry();
  entry.title = 'test';
  const entry_id = await create_entry(model, entry);
  const stored_entry = await get_entry(model, 'id', entry_id, false);
  assert(stored_entry);

  const non_existent_id = 123456789;
  const non_existent_entry =
      await get_entry(model, 'id', non_existent_id, false);
  assert(non_existent_entry === undefined);

  model.close();
  await indexeddb_utils.remove(db_name);
}
