import * as IndexedDbUtils from "/src/common/indexeddb-utils.js";
import * as Status from "/src/common/status.js";
import FeedStore from "/src/feed-store/feed-store.js";

// TODO: this should operate on a test database, not the live database

async function test() {
  const store = new FeedStore();
  const limit = 5;
  let maxAgeMs;
  let closeRequested = false;

  try {
    await store.open();
    const status = await store.archiveEntries(maxAgeMs, limit);
    if(status !== Status.OK) {
      throw new Error('Failed to archive entries with status ' + status);
    }
    store.close();
    closeRequested = true;
    await IndexedDbUtils.remove(store.conn.name);
  } finally {
    if(!closeRequested) {
      store.close();
    }
  }
}
