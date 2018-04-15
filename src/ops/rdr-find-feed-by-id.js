import {feed_id_is_valid} from '/src/objects/feed.js';

export function rdr_find_feed_by_id(conn, id) {
  if (!feed_id_is_valid(id)) {
    throw new TypeError('id is not a valid feed id: ' + id);
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
