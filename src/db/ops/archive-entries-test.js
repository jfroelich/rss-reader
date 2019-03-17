import archive_entries from '/src/db/ops/archive-entries.js';
import db_open from '/src/db/ops/open.js';
import assert from '/src/lib/assert.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';

export async function archive_entries_test() {
  const db_name = 'archive-entries-test';
  await indexeddb_utils.remove(db_name);

  const conn = await db_open(db_name);

  const max_age = 100;
  let channel;
  await archive_entries(conn, channel, max_age);

  conn.close();
  await indexeddb_utils.remove(db_name);
}
