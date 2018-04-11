import {entry_is_valid_id, ENTRY_STATE_READ, ENTRY_STATE_UNREAD, is_entry} from '/src/objects/entry.js';
import {rdr_badge_refresh} from '/src/ops/rdr-badge-refresh.js';

export function rdr_mark_entry_read(entry_id) {
  if (!entry_is_valid_id(entry_id)) {
    throw new TypeError('entry_id is not a valid entry id: ' + entry_id);
  }

  return new Promise(executor.bind(this, entry_id));
}

function executor(entry_id, resolve, reject) {
  const txn = this.conn.transaction('entry', 'readwrite');
  txn.oncomplete = txn_oncomplete.bind(this, entry_id, resolve);
  txn.onerror = _ => reject(txn.error);
  const store = txn.objectStore('entry');
  const request = store.get(entry_id);
  request.onsuccess = request_onsuccess.bind(this, entry_id);
}

function request_onsuccess(entry_id, event) {
  const entry = event.target.result;
  if (!entry) {
    this.console.warn('No entry found', entry_id);
    return;
  }

  if (!is_entry(entry)) {
    this.console.warn('Invalid matched object type', entry_id, entry);
    return;
  }

  if (entry.readState === ENTRY_STATE_READ) {
    this.console.warn('Entry already read', entry.id);
    return;
  }

  if (entry.readState !== ENTRY_STATE_UNREAD) {
    this.console.warn('Entry not unread', entry.id);
    return;
  }

  entry.readState = ENTRY_STATE_READ;
  const currentDate = new Date();
  entry.dateUpdated = currentDate;
  entry.dateRead = currentDate;

  const entry_store = event.target.source;
  entry_store.put(entry);
}

function txn_oncomplete(entry_id, callback, event) {
  this.console.debug('Marked entry as read', entry_id);
  this.channel.postMessage({type: 'entry-marked-read', id: entry_id});
  const conn = event.target.db;
  rdr_badge_refresh(conn, this.console).catch(this.console.error);
  callback();
}
