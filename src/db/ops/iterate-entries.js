import {assert} from '/src/assert.js';

export default function iterate_entries(conn, handle_entry) {
  return new Promise((resolve, reject) => {
    assert(typeof handle_entry === 'function');
    const txn = conn.transaction('entry', 'readwrite');
    txn.oncomplete = resolve;
    txn.onerror = event => reject(event.target.error);
    const store = txn.objectStore('entry');
    const request = store.openCursor();

    request.onsuccess = event => {
      const cursor = request.result;
      if (!cursor) {
        return;
      }

      try {
        handle_entry(cursor);
      } catch (error) {
        console.warn(error);
      }

      cursor.continue();
    };
  });
}
