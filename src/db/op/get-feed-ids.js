export function get_feed_ids(session) {
  return new Promise(get_feed_ids_executor.bind(null, session.conn));
}

function get_feed_ids_executor(conn, resolve, reject) {
  const txn = conn.transaction('feed');
  txn.onerror = event => reject(event.target.error);
  const store = txn.objectStore('feed');
  const request = store.getAllKeys();
  request.onsuccess = _ => resolve(request.result);
}
