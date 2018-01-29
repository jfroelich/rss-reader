import {isValidFeedId, open} from "/src/rdb.js";

// TODO: does this potentially affect unread count? In which case this desync's
// badge text? I may have wrote this comment before introducing channel, can
// not remember.

// Scans the database for entries not linked to a feed and deletes them
// conn is optional open database connection
// channel is optional broadcast channel
export default async function removeOrphanedEntries(conn, channel) {

  const dconn = conn ? conn : await open();
  const entryIds = await removeOrphanedEntriesPromise(dconn);
  if(!conn) {
    dconn.close();
  }

  // Now that the transaction committed, notify observers
  if(channel && entryIds.length) {
    const message = {type: 'entry-deleted', id: null, reason: 'orphan'};
    for(const id of entryIds) {
      message.id = id;
      channel.postMessage(message);
    }
  }
}

// Resolve to the array of deleted entry ids
function removeOrphanedEntriesPromise(conn) {
  return new Promise((resolve, reject) => {
    const entryIds = [];
    const tx = conn.transaction(['feed', 'entry'], 'readwrite');
    tx.oncomplete = () => resolve(entryIds);
    tx.onerror = () => reject(tx.error);

    const feedStore = tx.objectStore('feed');
    const getFeedIdsRequest = feedStore.getAllKeys();
    getFeedIdsRequest.onsuccess = () => {
      const feedIds = getFeedIdsRequest.result;

      // Use cursor instead of getAll to limit the amount of entries loaded.
      // This is slower than getAll but that is ok because this is a bg task

      const entryStore = tx.objectStore('entry');
      const entryRequest = entryStore.openCursor();
      entryRequest.onsuccess = () => {
        const cursor = entryRequest.result;
        if(cursor) {
          const entry = cursor.value;
          if(!isValidFeedId(entry.feed) || !feedIds.includes(entry.feed)) {
            entryIds.push(entry.id);
            console.debug('Deleting orphaned entry', entry.id);
            cursor.delete();
          }

          cursor.continue();
        }
      };
    };
  });
}
