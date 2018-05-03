import {is_valid_entry_id} from '/src/objects/entry.js';

// TODO: move to entry-store.js
// TODO: finish up migration from find_entry_id_by_url

export async function contains_entry(conn, query) {
  if (!(query.url instanceof URL)) {
    throw new TypeError('Invalid query ' + query);
  }

  const id = await find_entry_id_by_url(conn, query.url);
  return is_valid_entry_id(id);
}

function find_entry_id_by_url(conn, url) {
  return new Promise(executor.bind(null, conn, url));
}

function executor(conn, url, resolve, reject) {
  const context = {entry_id: null, callback: resolve};

  const txn = conn.transaction('entry');
  txn.oncomplete = txn_oncomplete.bind(txn, context);
  txn.onerror = _ => reject(txn.error);

  const store = txn.objectStore('entry');
  const index = store.index('urls');
  const request = index.getKey(url.href);
  request.onsuccess = request_onsuccess.bind(request, context);
}

function txn_oncomplete(context, event) {
  context.callback(context.entry_id);
}

function request_onsuccess(context, event) {
  context.entry_id = event.target.result;
}
