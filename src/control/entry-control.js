import {assert} from '/src/assert/assert.js';
import * as Entry from '/src/model/entry.js';

export function get_entry(conn, mode = 'id', value, key_only) {
  return new Promise((resolve, reject) => {
    assert(mode !== 'id' || Entry.is_valid_entry_id(value));
    assert(mode !== 'id' || !key_only);

    const txn = conn.transaction('entry');
    txn.onerror = _ => reject(txn.error);
    const store = txn.objectStore('entry');

    let request;
    if (mode === 'url') {
      const index = store.index('urls');
      const href = value.href;
      request = key_only ? index.getKey(href) : index.get(href);
    } else if (mode === 'id') {
      request = store.get(value);
    } else {
      throw new TypeError('Invalid mode ' + mode);
    }

    request.onsuccess = _ => {
      let entry;
      if (key_only) {
        const entry_id = request.result;
        if (Entry.is_valid_entry_id(entry_id)) {
          entry = Entry.create_entry();
          entry.id = entry_id;
        }
      } else {
        entry = request.result;
      }

      resolve(entry);
    };
  });
}

export function get_entries(conn, mode = 'all', offset = 0, limit = 0) {
  return new Promise((resolve, reject) => {
    assert(
        offset === null || typeof offset === 'undefined' || offset === NaN ||
        (Number.isInteger(offset) && offset >= 0));
    assert(
        limit === null || typeof limit === 'undefined' || limit === NaN ||
        (Number.isInteger(limit) && limit >= 0));

    const entries = [];
    let advanced = false;

    const txn = conn.transaction('entry');
    txn.oncomplete = _ => resolve(entries);
    txn.onerror = _ => reject(txn.error);
    const store = txn.objectStore('entry');

    let request;
    if (mode === 'viewable') {
      const index = store.index('archiveState-readState');
      const path = [Entry.ENTRY_STATE_UNARCHIVED, Entry.ENTRY_STATE_UNREAD];
      request = index.openCursor(path);
    } else if (mode === 'all') {
      request = store.openCursor();
    } else {
      throw new TypeError('Invalid mode ' + mode);
    }

    request.onsuccess = _ => {
      const cursor = request.result;
      if (!cursor) {
        return;
      }

      // If an offset was specified and we did not yet advance, then seek
      // forward. Ignore the value at the current position.
      if (offset && !advanced) {
        advanced = true;
        cursor.advance(offset);
        return;
      }

      entries.push(cursor.value);

      // Stop if limit defined and reached or surpassed limit.
      if (limit > 0 && entries.length >= limit) {
        return;
      }

      cursor.continue();
    };
  });
}

export function delete_entry(conn, channel, id, reason) {
  return new Promise((resolve, reject) => {
    assert(Entry.is_valid_entry_id(id));  // prevent fake noops
    const txn = conn.transaction('entry', 'readwrite');
    txn.oncomplete = _ => {
      // Unlike delete_feed this does not expose feed id because it would
      // require an extra lookup.
      const msg = {type: 'entry-deleted', id: id, reason: reason};
      channel.postMessage(msg);
      resolve();
    };
    txn.onerror = _ => reject(txn.error);
    txn.objectStore('entry').delete(id);
  });
}
