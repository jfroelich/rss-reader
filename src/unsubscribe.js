// See license.md

'use strict';

{ // Begin file block scope

// Removes a feed and all of its associated entries from the database.
// @param conn {IDBDatabase} an open database connection
// @param feedId {Number} id of feed to unscubscribe
// @param verbose {Boolean} whether to print logging info
async function unsubscribe(conn, feedId, verbose) {
  if(verbose) {
    console.log('Unsubscribing feed with id', feedId);
  }

  if(!Number.isInteger(feedId) || feedId < 1) {
    throw new TypeError(`Invalid feed id ${feedId}`);
  }

  const entryIds = await loadEntryIdsForFeedFromDb(conn, feedId);
  await removeFeedAndEntriesFromDb(conn, feedId, entryIds);
  dispatchRemoveEvents(feedId, entryIds);

  if(verbose) {
    console.debug('Unsubscribed from feed id', feedId, ', deleted %d entries',
      entryIds.length);
  }

  await updateBadgeText(conn);
  return entryIds.length;
}

this.unsubscribe = unsubscribe;

function dispatchRemoveEvents(feedId, entryIds) {
  const channel = new BroadcastChannel('db');
  channel.postMessage({'type': 'feedDeleted', 'id': feedId});
  for(let entryId of entryIds) {
    channel.postMessage({'type': 'entryDeleted', 'id': entryId});
  }
  channel.close();
}

function loadEntryIdsForFeedFromDb(conn, feedId) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('feed');
    const request = index.getAllKeys(feedId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function removeFeedAndEntriesFromDb(conn, feedId, entryIds) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction(['feed', 'entry'], 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);

    const feedStore = tx.objectStore('feed');
    feedStore.delete(feedId);

    const entryStore = tx.objectStore('entry');
    for(let entryId of entryIds) {
      entryStore.delete(entryId);
    }
  });
}

} // End file block scope
