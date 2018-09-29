import assert from '/src/assert/assert.js';

export function iterate_entries(conn, handle_entry) {
  assert(typeof handle_entry === 'function');
  return iterate_entries_internal(conn, handle_entry);
}

// TODO: inline, this is temporary form during transition away from older design
function iterate_entries_internal(conn, handle_entry) {
  return new Promise(iterate_entries_executor.bind(null, conn, handle_entry));
}

function iterate_entries_executor(conn, handle_entry, resolve, reject) {
  const txn = conn.transaction('entry', 'readwrite');
  txn.oncomplete = resolve;
  txn.onerror = event => reject(event.target.error);
  const store = txn.objectStore('entry');
  const request = store.openCursor();

  // TODO: move function definition outside of this function
  request.onsuccess = _ => {
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
}
