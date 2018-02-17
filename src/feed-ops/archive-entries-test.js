import archive_entries from '/src/feed-ops/archive-entries.js';
import {rdb_open} from '/src/rdb.js';

async function test() {
  let conn, channel, max_age;
  const conn = await rdb_open('archive-entries-test');
  await archive_entries(conn, channel, max_age);
  conn.close();
  await remove(conn.name);
}

function remove(name) {
  return new Promise(function executor(resolve, reject) {
    console.debug('Deleting database', name);
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
