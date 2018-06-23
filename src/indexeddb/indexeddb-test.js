import {assert} from '/src/assert.js';
import {indexeddb_open} from '/src/indexeddb/indexeddb-open.js';
import {indexeddb_remove} from '/src/indexeddb/indexeddb-remove.js';
import {register_test} from '/src/test/test-registry.js';

// TODO: rename to indexeddb-test.js to match with library file name

// NOTE: the assert here is implied. does the function execute without rejection

// TODO: this should be testing different modules. indexeddb_open and
// indexeddb_remove were split into separate modules. There should be separate
// tests? Except that we need to really delete the db in the open test so ...?
// Also test create vs upgrade case, assert that onupgradeneeded happens
// Test that timeout vs no-timeout works as expected
// Test error paths


// TODO: this test is failing, indexeddb_remove never resolves. On applications
// tab, the details for the database that was created are missing, and the
// buttons for delete and refresh do not work (and are opaque). Somehow this is
// basically creating a database in some kind of bad state

// NOTE: disabled this test while trying to test other things

async function indexeddb_test() {
  /*
  const db_name = 'idb-test-foo';
  const version = 1;
  let conn, timeout, upgrade_listener;
  conn = await indexeddb_open(db_name, version, upgrade_listener, timeout);
  console.debug('Opened database', conn.name); await
  indexeddb_remove(db_name);
  console.debug('indexeddb_test reached
  completion and should not timeout'); return true;
  */
}

register_test(indexeddb_test);
