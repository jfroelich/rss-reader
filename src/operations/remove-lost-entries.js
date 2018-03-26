import {entry_has_url} from '/src/objects/entry.js';

export async function remove_lost_entries(
    conn, channel = NULL_CHANNEL, console = NULL_CONSOLE) {
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

const NULL_CHANNEL = {
  postMessage: noop,
  close: noop
};

// A partial stub for console that suppresses log messages
const NULL_CONSOLE = {
  log: noop,
  warn: noop,
  debug: noop
};
