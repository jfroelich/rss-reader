import {db_archive_entries} from '/src/db/db-archive-entries.js';
import {db_open} from '/src/db/db-open.js';
import {indexeddb_remove} from '/src/lib/indexeddb/indexeddb-remove.js';
import {assert} from '/src/tests/assert.js';
import {register_test} from '/src/tests/test-registry.js';

// TODO: actually assert something, what am I trying to test other than 'does it
// run'? I need to insert archivable data, non-archivable data, and then assert
// the archivable data was archived, and that the non-archivable data was not
// archived

async function archive_entries_test() {
  let dbname = 'archive-entries-test', version, timeout, max_age;
  const conn = await db_open(dbname, version, timeout);
  const op = {};
  op.conn = conn;
  op.channel = {name: 'stub', postMessage: noop, close: noop};
  op.db_archive_entries = db_archive_entries;
  await op.db_archive_entries(max_age);

  conn.close();
  op.channel.close();
  await indexeddb_remove(conn.name);
}

function noop() {}

register_test(archive_entries_test);
