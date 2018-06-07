import {archive_entries} from '/src/archive.js';
import {indexeddb_remove} from '/src/lib/indexeddb/indexeddb-remove.js';
import {open_reader_db} from '/src/reader-db.js';
import {assert} from '/src/tests/assert.js';
import {register_test} from '/src/tests/test-registry.js';

// TODO: actually assert something, what am I trying to test other than 'does it
// run'? I need to insert archivable data, non-archivable data, and then assert
// the archivable data was archived, and that the non-archivable data was not
// archived

async function archive_entries_test() {
  const dbname = 'archive-entries-test';
  let dbversion, dbtimeout;
  const conn = await open_reader_db(dbname, dbversion, dbtimeout);
  const channel = {name: 'stub', postMessage: noop, close: noop};
  await archive_entries(conn, channel);
  conn.close();
  channel.close();
  await indexeddb_remove(conn.name);
}

function noop() {}

register_test(archive_entries_test);
