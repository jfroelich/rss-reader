import {assert} from '/src/assert/assert.js';
import {filter_empty_properties} from '/src/lang/filter-empty-properties.js';
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

export function iterate_entries(conn, mode = 'all', writable, handle_entry) {
  return new Promise((resolve, reject) => {
    const txn_mode = writable ? 'readwrite' : 'readonly';
    const txn = conn.transaction('entry', txn_mode);
    txn.oncomplete = resolve;
    txn.onerror = _ => reject(txn.error);
    const store = txn.objectStore('entry');

    let request;
    if (mode === 'archive') {
      const index = store.index('archiveState-readState');
      const key_path = [Entry.ENTRY_STATE_UNARCHIVED, Entry.ENTRY_STATE_READ];
      request = index.openCursor(key_path);
    } else if (mode === 'all') {
      request = store.openCursor();
    } else {
      throw new Error('Invalid mode ' + mode);
    }

    request.onsuccess = _ => {
      const cursor = request.result;
      if (!cursor) {
        return;
      }

      handle_entry(cursor);
      cursor.continue();
    };
  });
}

export function mark_entry_read(conn, channel, entry_id) {
  return new Promise((resolve, reject) => {
    assert(Entry.is_valid_entry_id(entry_id));
    const txn = conn.transaction('entry', 'readwrite');
    txn.oncomplete = _ => {
      channel.postMessage({type: 'entry-read', id: entry_id});
      resolve();
    };
    txn.onerror = _ => reject(txn.error);

    const store = txn.objectStore('entry');
    const request = store.get(entry_id);
    request.onsuccess = _ => {
      const entry = request.result;
      assert(Entry.is_entry(entry));
      // Once an entry enters the archive state, it should require direct
      // property access to manipulate read state, so prevent access here. This
      // helper is only intended for use on unarchived entries
      assert(entry.archiveState !== Entry.ENTRY_STATE_ARCHIVED);
      assert(entry.readState !== Entry.ENTRY_STATE_READ);

      entry.readState = Entry.ENTRY_STATE_READ;
      const currentDate = new Date();
      entry.dateUpdated = currentDate;
      entry.dateRead = currentDate;

      request.source.put(entry);
    };
  });
}

export function update_entry(conn, channel, entry) {
  return new Promise((resolve, reject) => {
    assert(Entry.is_entry(entry));

    const creating = !entry.id;
    if (creating) {
      entry.readState = Entry.ENTRY_STATE_UNREAD;
      entry.archiveState = Entry.ENTRY_STATE_UNARCHIVED;
      entry.dateCreated = new Date();
      delete entry.dateUpdated;
    } else {
      entry.dateUpdated = new Date();
    }

    filter_empty_properties(entry);

    const txn = conn.transaction('entry', 'readwrite');
    txn.oncomplete = _ => {
      const message = {type: 'entry-write', id: entry.id, 'create': creating};
      console.debug(message);
      channel.postMessage(message);
      resolve(entry.id);
    };
    txn.onerror = _ => reject(txn.error);
    const store = txn.objectStore('entry');
    const request = store.put(entry);
    if (creating) {
      request.onsuccess = _ => entry.id = request.result;
    }
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
