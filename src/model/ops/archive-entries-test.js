import * as indexeddb_utils from '/src/indexeddb-utils/indexeddb-utils.js';
import {Model} from '/src/model/model.js';
import archive_entries from '/src/model/ops/archive-entries.js';

export async function archive_entries_test() {
  const db_name = 'archive-entries-test';
  await indexeddb_utils.remove(db_name);
  const model = new Model();
  model.name = db_name;
  await model.open();
  await archive_entries(model, 100);
  model.close();
  await indexeddb_utils.remove(db_name);
}
