import {is_valid_entry_id} from '/src/db/entry.js';

export async function contains_entry(conn, query) {
  if (!(query.url instanceof URL)) {
    throw new TypeError('Invalid query ' + query);
  }

  const id = await find_entry_id_by_url(conn, query.url);
  return is_valid_entry_id(id);
}

function find_entry_id_by_url(conn, url) {
  return new Promise(find_entry_id_by_url_executor.bind(null, conn, url));
}

function find_entry_id_by_url_executor(conn, url, resolve, reject) {
  const context = {entry_id: 0, callback: resolve};

  const txn = conn.transaction('entry');
  txn.oncomplete = find_entry_id_by_url_txn_oncomplete.bind(txn, context);
  txn.onerror = _ => reject(txn.error);

  const store = txn.objectStore('entry');
  const index = store.index('urls');
  const request = index.getKey(url.href);
  request.onsuccess =
      find_entry_id_by_url_request_onsuccess.bind(request, context);
}

function find_entry_id_by_url_txn_oncomplete(context, event) {
  context.callback(context.entry_id);
}

function find_entry_id_by_url_request_onsuccess(context, event) {
  context.entry_id = event.target.result;
}
