import {is_valid_feed_id} from '/src/feed-store/feed.js';

// TODO: create find-feed.js, merge find-feed-by-id and find-feed-by-url into
// find-feed.js

// TODO: actually, create read-feed.js, and read-feeds.js. All related
// functionality should be merged into these two functions. This is essentially
// an attempt at a REST-style API. Should do similar to entries


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
