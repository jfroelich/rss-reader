import {entryHasURL, open as openReaderDb} from "/src/rdb.js";

// TODO: update callers to use new channel argument, and optional conn parameter pattern,
// and no status

// Scans the entry store for entry objects that are missing urls and removes them
export default async function removeLostEntries(conn, channel) {
  const dconn = conn ? conn : await openReaderDb();
  const entryIds = await removeLostEntriesPromise(dconn);
  if(!conn) {
    dconn.close();
  }

  // Now that the transaction has fully committed, notify observers
  if(channel) {
    const message = {type: 'entry-deleted', id: undefined, reason: 'lost'};
    for(const id of entryIds) {
      message.id = id;
      channel.postMessage(message);
    }
  }
}

// Returns a promise that resolves to an array of entry ids that were deleted
function removeLostEntriesPromise(conn) {
  return new Promise((resolve, reject) => {
    const entryIds = [];

    // Use a single transaction for read and deletes to ensure consistency.

    const tx = conn.transaction('entry', 'readwrite');
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve(entryIds);
    const store = tx.objectStore('entry');

    // Although getAll would be faster, it does not scale. Instead, walk the
    // store one entry at a time using a cursor.
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if(!cursor) {
        return;
      }

      const entry = cursor.value;

      if(!entryHasURL(entry)) {
        console.debug('Deleting lost entry', entry.id);

        // Calling delete appends a request to the transaction. Remember that nothing
        // has committed until the transaction completes. Therefore it would be
        // inappropriate to do channel notifications here because it would be
        // immature.
        // TODO: what if I post a message with the property 'speculative', or
        // post a message of a different type, like 'entry-speculatively-deleted'?
        // Worth it? Pedantic?

        cursor.delete();

        // Track which entries have been deleted
        entryIds.push(entry.id);
      }

      cursor.continue();
    };
  });
}
