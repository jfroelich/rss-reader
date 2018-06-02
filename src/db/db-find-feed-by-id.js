import {is_valid_feed_id} from '/src/feed.js';

// TODO: create read-feed.js, and read-feeds.js. All related functionality
// should be merged into these two functions. This is essentially an attempt at
// a REST-style API. Should do similar to entries

export function db_find_feed_by_id(conn, id) {
  return new Promise(executor.bind(null, conn, id));
}

function executor(conn, id, resolve, reject) {
  if (!is_valid_feed_id(id)) {
    throw new TypeError('Invalid feed id ' + id);
  }

  const txn = conn.transaction('feed');
  const store = txn.objectStore('feed');
  const request = store.get(id);
  request.onsuccess = _ => resolve(request.result);
  request.onerror = _ => reject(request.error);
}
