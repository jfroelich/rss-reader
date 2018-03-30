import {entry_is_valid_id} from '/src/objects/entry.js';

// TODO: deprecate in favor of find_entry_by_url
// TODO: the promise should not resolve until the transaction resolves

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
  request.onsuccess = request_onsuccess.bind(request, resolve);
  request.onerror = _ => reject(request.error);
}

function request_onsuccess(callback, event) {
  const entry_id = event.target.result;
  resolve(entry_is_valid_id(entry_id));
}
