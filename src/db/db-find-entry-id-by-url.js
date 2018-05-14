export function db_find_entry_id_by_url(url) {
  return new Promise((resolve, reject) => {
    let entry_id;
    const txn = this.conn.transaction('entry');
    txn.oncomplete = _ => resolve(entry_id);
    txn.onerror = _ => reject(txn.error);

    const store = txn.objectStore('entry');
    const index = store.index('urls');
    const request = index.getKey(url.href);
    request.onsuccess = _ => entry_id = request.result;
  });
}
