export function get_feed_ids(conn) {
  return new Promise(get_feed_ids_executor.bind(null, conn));
}

function get_feed_ids_executor(conn, resolve, reject) {
  const txn = conn.transaction('feed');
  txn.onerror = event => reject(event.target.error);
  const store = txn.objectStore('feed');
  const request = store.getAllKeys();
  request.onsuccess = _ => resolve(request.result);
}
