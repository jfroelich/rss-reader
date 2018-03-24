import * as rdb from '/src/rdb/rdb.js';

export function update_entry(conn, channel, entry) {
  return new Promise(executor.bind(null, conn, channel, entry));
}

function executor(conn, channel, entry, resolve, reject) {
  assert(rdb.is_entry(entry));
  const txn = conn.transaction('entry', 'readwrite');
  const store = txn.objectStore('entry');
  const request = store.put(entry);
  request.onsuccess = request_onsuccess.bind(request, channel, resolve);
  request.onerror = _ => reject(request.error);
}

function request_onsuccess(channel, callback, event) {
  const entry_id = event.target.result;
  if (channel) {
    channel.postMessage({type: 'entry-updated', id: entry_id});
  }
  callback(entry_id);
}

function assert(value) {
  if (!value) throw new Error('Assertion error');
}
