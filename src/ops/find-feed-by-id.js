import {is_valid_feed_id} from '/src/objects/feed.js';

// TODO: create find-feed.js, merge find-feed-by-id and find-feed-by-url into
// find-feed.js

export function find_feed_by_id(conn, id) {
  if (!is_valid_feed_id(id)) {
    throw new TypeError('Invalid feed id ' + id);
  }

  return new Promise(executor.bind(null, conn, id));
}

function executor(conn, id, resolve, reject) {
  const txn = conn.transaction('feed');
  const store = txn.objectStore('feed');
  const request = store.get(id);
  request.onsuccess = _ => resolve(request.result);
  request.onerror = _ => reject(request.error);
}
