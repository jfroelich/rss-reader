import {idb_open, idb_remove} from '/src/idb/idb.js';

async function test() {
  const name = 'indexeddb-utils-test';
  const version = 1;
  let conn, timeout, upgrade_listener;

  try {
    conn = await idb_open(name, version, upgrade_listener, timeout, console);
  } finally {
    if (conn) {
      conn.close();
    }
  }

  if (conn) {
    await idb_remove(name);
  }

  console.debug('Test completed');
}

window.test = test;
