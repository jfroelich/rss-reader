import {console_stub} from '/src/lib/console-stub/console-stub.js';
import {entry_has_url} from '/src/objects/entry.js';

const channel_stub = {
  name: 'channel-stub',
  postMessage: noop,
  close: noop
};

export async function remove_lost_entries(
    conn, channel = channel_stub, console = console_stub) {
  return new Promise(executor.bind(null, conn, channel, console));
}

function executor(conn, channel, console, resolve, reject) {
  const ids = [];
  const txn = conn.transaction('entry', 'readwrite');
  txn.oncomplete = txn_oncomplete.bind(txn, channel, ids, resolve);
  txn.onerror = _ => reject(txn.error);

  const store = txn.objectStore('entry');
  const request = store.openCursor();
  request.onsuccess = request_onsuccess.bind(request, ids, console);
}

function request_onsuccess(ids, console, event) {
  const cursor = request.result;
  if (cursor) {
    const entry = cursor.value;
    if (!entry_has_url(entry)) {
      console.debug('Deleting lost entry', entry.id);
      cursor.delete();
      ids.push(entry.id);
    }

    cursor.continue();
  }
}

function txn_oncomplete(channel, ids, callback, event) {
  console.debug('Removed %d lost entries', ids.length);

  const message = {type: 'entry-deleted', id: undefined, reason: 'lost'};
  for (const id of ids) {
    message.id = id;
    channel.postMessage(message);
  }

  callback();
}

function noop() {}
