import Entry from '/src/db/object/entry.js';
import create_entry from '/src/db/ops/create-entry.js';
import iterate_entries from '/src/db/ops/iterate-entries.js';
import db_open from '/src/db/ops/open.js';
import assert from '/src/lib/assert.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';

export async function iterate_entries_test() {
  const db_name = 'iterate-entries-test';
  await indexeddb_utils.remove(db_name);

  const conn = await db_open(db_name);

  const n = 5;
  const create_promises = [];
  for (let i = 0; i < n; i++) {
    const entry = new Entry();
    entry.title = 'test' + i;
    create_promises.push(create_entry(conn, undefined, entry));
  }
  const ids = await Promise.all(create_promises);

  let num_iterated = 0;
  await iterate_entries(conn, entry => {
    assert(entry);
    num_iterated++;
  });
  assert(num_iterated === n);

  conn.close();
  await indexeddb_utils.remove(db_name);
}
