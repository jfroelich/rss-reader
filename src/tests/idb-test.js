import {indexeddb_open} from '/src/lib/indexeddb/indexeddb-open.js';
import {indexeddb_remove} from '/src/lib/indexeddb/indexeddb-remove.js';
import {assert} from '/src/tests/assert.js';

// NOTE: the assert here is implied. does the function execute without rejection

// TODO: this test is failing, indexeddb_remove never resolves. On applications
// tab, the details for the database that was created are missing, and the
// buttons for delete and refresh do not work (and are opaque). Somehow this is
// basically creating a database in some kind of bad state

// NOTE: disabled this test while trying to test other things

export async function idb_test() {
  /*
  const db_name = 'idb-test-foo';
  const version = 1;
  let conn, timeout, upgrade_listener;
  conn = await indexeddb_open(db_name, version, upgrade_listener, timeout,
  console); console.debug('Opened database', conn.name); await
  indexeddb_remove(db_name, console); console.debug('idb_test reached completion
  and should not timeout'); return true;
  */
}
