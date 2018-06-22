
export function get_feed_ids(conn) {
  return new Promise((resolve, reject) => {
    const txn = conn.transaction('feed');
    txn.onerror = _ => reject(txn.error);
    const store = txn.objectStore('feed');
    const request = store.getAllKeys();
    request.onsuccess = _ => resolve(request.result);
  });
}
