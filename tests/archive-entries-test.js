import FeedStore from "/src/feed-store/feed-store.js";
import * as IndexedDbUtils from "/src/utils/indexeddb-utils.js";

// TODO: this should operate on a test database, not the live database

async function test() {
  const store = new FeedStore();
  const limit = 5;
  let maxAgeMs;
  let closeRequested = false;

  try {
    await store.open();
    await store.archiveEntries(maxAgeMs, limit);
    store.close();
    closeRequested = true;
    await IndexedDbUtils.remove(store.conn.name);
  } finally {
    if(!closeRequested) {
      store.close();
    }
  }
}
