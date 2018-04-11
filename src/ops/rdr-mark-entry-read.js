import {entry_is_valid_id, ENTRY_STATE_READ, ENTRY_STATE_UNREAD, is_entry} from '/src/objects/entry.js';
import {rdr_badge_refresh} from '/src/ops/rdr-badge-refresh.js';

export function rdr_mark_entry_read(conn, channel, entry_id) {
  if (!entry_is_valid_id(entry_id)) {
    throw new TypeError('entry_id is not a valid entry id: ' + entry_id);
  }

  return new Promise(executor.bind(null, conn, channel, entry_id));
}

function executor(conn, channel, entry_id, resolve, reject) {
  const txn = conn.transaction('entry', 'readwrite');
  txn.oncomplete = txn_oncomplete.bind(txn, conn, channel, entry_id, resolve);
  txn.onerror = _ => reject(txn.error);
  const store = txn.objectStore('entry');
  const request = store.get(entry_id);
  request.onsuccess = request_onsuccess.bind(request, entry_id);
}

function request_onsuccess(entry_id, event) {
  const entry = event.target.result;
  if (!entry) {
    console.warn('No entry found for entry id', entry_id);
    return;
  }

  if (!is_entry(entry)) {
    console.warn('Matched object for id %d is not an entry', entry_id, entry);
    return;
  }

  if (entry.readState === ENTRY_STATE_READ) {
    console.warn('Entry %d already in read state, ignoring', entry.id);
    return;
  }

  if (entry.readState !== ENTRY_STATE_UNREAD) {
    console.warn('Entry %d not in unread state, ignoring', entry.id);
    return;
  }

  entry.readState = ENTRY_STATE_READ;
  const currentDate = new Date();
  entry.dateUpdated = currentDate;
  entry.dateRead = currentDate;

  const entry_store = event.target.source;
  entry_store.put(entry);
}

function txn_oncomplete(conn, channel, entry_id, callback, event) {
  if (channel) {
    try {
      channel.postMessage({type: 'entry-marked-read', id: entry_id});
    } catch (error) {
      console.debug(error);
    }
  }

  console.debug('Marked entry %d as read', entry_id);

  rdr_badge_refresh(conn, void console).catch(console.error);

  callback();
}