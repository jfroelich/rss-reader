import {assert} from '/src/assert.js';
import * as indexeddb_utils from '/src/indexeddb-utils/indexeddb-utils.js';
import {Model} from '/src/model/model.js';
import create_entry from '/src/model/ops/create-entry.js';
import delete_entry from '/src/model/ops/delete-entry.js';
import get_entry from '/src/model/ops/get-entry.js';

export async function delete_entry_test() {
  const db_name = 'delete-entry-test';
  await indexeddb_utils.remove(db_name);

  const model = new Model();
  model.name = db_name;
  await model.open();

  const entry1 = new Entry();
  const url1 = new URL('https://www.example1.com');
  entry1.appendURL(url1);

  const entry2 = new Entry();
  const url2 = new URL('https://www.example2.com');
  entry2.appendURL(url2);

  const entry_id1 = await create_entry(model, entry1);
  const entry_id2 = await create_entry(model, entry2);
  let stored_entry = await get_entry(model, 'id', entry_id1, false);
  assert(stored_entry);
  await delete_entry(model, entry_id1, 'test');
  stored_entry = undefined;
  stored_entry = await get_entry(model, 'id', entry_id1, false);
  assert(!stored_entry);
  stored_entry = undefined;
  stored_entry = await get_entry(model, 'id', entry_id2, false);
  assert(stored_entry);
  model.close();
  await indexeddb_utils.remove(db_name);
}
