import {open} from '/src/common/indexeddb-utils.js';

async function test() {
  const name = 'indexeddb-utils-test';
  const version = 1;
  let conn, timeout, onUpgradeNeeded;

  try {
    conn = await open(name, version, onUpgradeNeeded, timeout);
  } finally {
    if (conn) {
      conn.close();
    }
  }

  if (conn) {
    await remove(name);
  }

  console.debug('Test completed');
}

function remove(name) {
  return new Promise(function executor(resolve, reject) {
    console.debug('Deleting database', name);
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

window.test = test;
