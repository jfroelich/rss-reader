import {entry_is_valid_id} from '/src/objects/entry.js';

export function contains_entry_with_url(conn, url) {
  if (!(url instanceof URL)) {
    throw new TypeError('url is not a URL: ' + url);
  }

  return new Promise(executor.bind(null, conn, url));
}

function executor(conn, url, resolve, reject) {
  const txn = conn.transaction('entry');
  const store = txn.objectStore('entry');
  const index = store.index('urls');
  const request = index.getKey(url.href);
  request.onsuccess = _ => resolve(entry_is_valid_id(request.result));
  request.onerror = _ => reject(request.error);
}
