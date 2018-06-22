import {assert} from '/src/assert/assert.js';
import * as Entry from '/src/data-layer/entry.js';

export function delete_entry(conn, post_message = noop, id, reason) {
  return new Promise((resolve, reject) => {
    assert(Entry.is_valid_entry_id(id));  // prevent fake noops
    const txn = conn.transaction('entry', 'readwrite');
    txn.oncomplete = _ => {
      // Unlike delete_feed this does not expose feed id because it would
      // require an extra lookup.
      const msg = {type: 'entry-deleted', id: id, reason: reason};
      post_message(msg);
      resolve();
    };
    txn.onerror = _ => reject(txn.error);
    txn.objectStore('entry').delete(id);
  });
}

function noop() {}
