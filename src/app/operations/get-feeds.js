
// TODO: deprecate in favor of an openCursor approach for scalability purposes

export function get_feeds(conn) {
  return new Promise(executor.bind(null, conn));
}

function executor(conn, resolve, reject) {
  const txn = conn.transaction('feed');
  const store = txn.objectStore('feed');
  const request = store.getAll();
  request.onsuccess = _ => resolve(request.result);
  request.onerror = _ => reject(request.error);
}
