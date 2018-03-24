import {feed_is_valid_id} from '/src/app/objects/feed.js';

export function find_feed_by_id(conn, id) {
  if (!feed_is_valid_id(id)) {
    throw new TypeError('id is not a valid feed id: ' + id);
  }

  return new Promise(executor.bind(null, conn, id));
}

function exector(conn, id, resolve, reject) {
  const txn = conn.transaction('feed');
  const store = txn.objectStore('feed');
  const request = store.get(id);
  request.onsuccess = _ => resolve(request.result);
  request.onerror = _ => reject(request.error);
}
