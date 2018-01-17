import archiveEntries from "/src/feed-ops/archive-entries.js";
import {open as openFeedStore} from "/src/feed-store/feed-store.js";

async function test() {
  let conn, channel, maxAge;
  const conn = await openFeedStore('archive-entries-test');
  await archiveEntries(conn, channel, maxAge);
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
