import {entry_is_valid, is_entry} from '/src/objects/entry.js';

export function write_entry(entry, validate) {
  if (!is_entry(entry)) {
    throw new TypeError('entry is not an entry ' + entry);
  }

  if (validate && !entry_is_valid(entry)) {
    throw new TypeError('invalid entry ' + entry);
  }

  return new Promise(executor.bind(this, entry));
}

function executor(entry, resolve, reject) {
  const txn = this.conn.transaction('entry', 'readwrite');
  const store = txn.objectStore('entry');
  const request = store.put(entry);
  request.onsuccess = request_onsuccess.bind(this, resolve);
  request.onerror = _ => reject(request.error);
}

function request_onsuccess(callback, event) {
  const entry_id = event.target.result;
  this.channel.postMessage({type: 'entry-updated', id: entry_id});
  this.console.debug('%s: wrote entry id %d', write_entry.name, entry_id);
  callback(entry_id);
}
