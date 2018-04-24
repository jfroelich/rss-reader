import {idb_open, idb_remove} from '/src/lib/idb.js';
import {assert} from '/src/tests/assert.js';

export async function idb_test() {
  const name = 'idb-test';
  const version = 1;
  let conn, timeout, upgrade_listener;
  conn = await idb_open(name, version, upgrade_listener, timeout, console);
  await idb_remove(name);
}
