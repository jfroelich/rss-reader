import assert from '/src/assert/assert.js';
import * as idbmodel from '/src/db/idb-model.js';
import {archive_entries} from '/src/db/op/archive-entries.js';
import * as indexeddb from '/src/indexeddb/indexeddb.js';
import {register_test} from '/test/test-registry.js';

// At the moment this test is a nominal stub that does not actually test
// anything

// TODO: insert archivable data, non-archivable data, and then assert the
// archivable data was archived, and that the non-archivable data was not
// archived

async function archive_entries_test() {
  const conn = await idbmodel.open('archive-entries-test');
  const max_age = 100;
  const ids = await archive_entries(conn, undefined, max_age);
  conn.close();
  await indexeddb.remove(conn.name);
}

register_test(archive_entries_test);
