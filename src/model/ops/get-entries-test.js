import {assert} from '/src/assert.js';
import * as indexeddb_utils from '/src/indexeddb-utils/indexeddb-utils.js';
import {Model} from '/src/model/model.js';
import create_entry from '/src/model/ops/create-entry.js';
import get_entries from '/src/model/ops/get-entries.js';

export async function get_entries_test() {
  const db_name = 'get-entries-test';
  await indexeddb_utils.remove(db_name);
  const model = new Model();
  model.name = db_name;
  await model.open();
  const n = 5;
  const create_promises = [];
  for (let i = 0; i < n; i++) {
    const entry = new Entry();
    entry.title = 'title ' + i;
    create_promises.push(create_entry(model, entry));
  }
  await Promise.all(create_promises);
  const entries = await get_entries(model, 'all', 0, 0);
  assert(entries.length === n);
  model.close();
  await indexeddb_utils.remove(db_name);
}
