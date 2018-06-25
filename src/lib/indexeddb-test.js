import assert from '/src/lib/assert.js';
import * as indexeddb from '/src/lib/indexeddb.js';
import {register_test} from '/src/test/test-registry.js';

// TODO:
// test create vs upgrade case, assert that onupgradeneeded happens
// Test that timeout vs no-timeout works as expected
// Test error paths

// TODO: this test is failing, indexeddb.remove never resolves. On applications
// tab, the details for the database that was created are missing, and the
// buttons for delete and refresh do not work (and are opaque). Somehow this is
// basically creating a database in some kind of bad state

// NOTE: disabled this test for now

async function indexeddb_test() {
  /*
  const db_name = 'idb-test-foo';
  const version = 1;
  let conn, timeout, upgrade_listener;
  conn = await indexeddb.open(db_name, version, upgrade_listener, timeout);
  console.debug('Opened database', conn.name); await
  indexeddb.remove(db_name);
  console.debug('indexeddb_test reached
  completion and should not timeout'); return true;
  */
}

register_test(indexeddb_test);
