// See license.md

'use strict';

{ // Begin file block scope

// Removes a feed and all of its associated entries from the database.
// @param conn {IDBDatabase} an open database connection
// @param feedId {Number} id of feed to unscubscribe
// @param verbose {Boolean} whether to print logging info
async function unsubscribe(conn, feedId, verbose) {

  if(verbose) {
    console.log('Unsubscribing from feed', feedId);
  }

  if(!Number.isInteger(feedId) || feedId < 1) {
    throw new TypeError(`Invalid feed id ${feedId}`);
  }

  const channel = new BroadcastChannel('db');
  let entryIds;

  // No catch block because I want exceptions to bubble
  try {
    const tx = conn.transaction(['feed', 'entry'], 'readwrite');
    entryIds = await getEntryIds(tx, feedId);
    await removeFeedAndEntries(tx, feedId, entryIds, channel);
  } finally {
    channel.close();
  }

  if(verbose) {
    console.debug('Unsubscribed from feed id', feedId, '. Deleted %d entries',
      entryIds.length);
  }

  updateBadgeText(conn); // not awaited
  return entryIds.length;
}

function getEntryIds(tx, feedId) {
  return new Promise((resolve, reject) => {
    const store = tx.objectStore('entry');
    const index = store.index('feed');
    const request = index.getAllKeys(feedId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function removeFeedAndEntries(tx, feedId, entryIds, channel) {
  const promises = new Array(entryIds.length);
  for(let entryId of entryIds) {
    const promise = removeEntry(tx, entryId, channel);
    promises.push(promise);
  }

  const promise = removeFeed(tx, feedId);
  promises.push(promise);
  return await Promise.all(promises);
}

function removeFeed(tx, feedId) {
  return new Promise((resolve, reject) => {
    const store = tx.objectStore('feed');
    const request = store.delete(feedId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function removeEntry(tx, id, channel) {
  return new Promise((resolve, reject) => {
    const store = tx.objectStore('entry');
    const request = store.delete(id);
    request.onsuccess = () => {
      if(channel) {
        channel.postMessage({'type': 'entryDeleted', 'id': id});
      }
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

} // End file block scope
