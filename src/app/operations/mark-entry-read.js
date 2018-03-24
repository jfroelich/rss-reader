import * as rdb from '/src/rdb/rdb.js';

export function mark_entry_read(conn, channel, entry_id) {
  return new Promise((resolve, reject) => {
    assert(rdb.entry_is_valid_id(entry_id));
    const txn = conn.transaction('entry', 'readwrite');
    txn.oncomplete = txn_oncomplete.bind(txn, channel, entry_id, resolve);
    txn.onerror = _ => reject(txn.error);
    const store = txn.objectStore('entry');
    const request = store.get(entry_id);
    request.onsuccess = request_onsuccess.bind(request, store);
  });
}

function request_onsuccess(store, event) {
  const entry = event.target.result;

  // If there was no matching entry for the entry id, this is a programming
  // error? Actually not really. The database entering into corrupted state
  // is technically ephemeral. And just plain bad.
  assert(entry);

  if (entry.readState === rdb.ENTRY_STATE_READ) {
    console.warn('Entry %d already in read state, ignoring', entry.id);
    return;
  }

  if (entry.readState !== rdb.ENTRY_STATE_UNREAD) {
    console.warn('Entry %d not in unread state, ignoring', entry.id);
    return;
  }

  entry.readState = rdb.ENTRY_STATE_READ;
  const currentDate = new Date();
  entry.dateUpdated = currentDate;
  entry.dateRead = currentDate;
  store.put(entry);
}

function txn_oncomplete(channel, entry_id, callback, event) {
  // channel may be closed by the time this executes when mark_entry_read
  // is not awaited, so trap the invalid state error and just log it
  if (channel) {
    try {
      channel.postMessage({type: 'entry-marked-read', id: entry_id});
    } catch (error) {
      console.debug(error);
    }
  }

  callback();
}

function assert(value) {
  if (!value) throw new Error('Assertion error');
}
