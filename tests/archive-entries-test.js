import * as IndexedDbUtils from "/src/common/indexeddb-utils.js";
import * as Status from "/src/common/status.js";
import archiveEntries from "/src/feed-ops/archive-entries.js";
import {open as openFeedStore} from "/src/feed-store/feed-store.js";

// TODO: this should operate on a test database, not the live database

async function test() {

  const limit = 5;
  let maxAgeMs;
  let closeRequested = false;

  try {
    conn = await openFeedStore();
    const status = await archiveEntries(store, maxAgeMs, limit);
    if(status !== Status.OK) {
      throw new Error('Failed to archive entries with status ' + status);
    }
    conn.close();
    closeRequested = true;
    await remove(store.conn.name);
  } finally {
    if(!closeRequested) {
      conn.close();
    }
  }
}

function remove(name) {
  return new Promise(function executor(resolve, reject) {
    console.debug('Deleting database', name);
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
