export async function db_remove_lost_entries() {
  return new Promise(executor.bind(this));
}

function executor(resolve, reject) {
  const ids = [];
  const stats = {visited_entry_count: 0};
  const txn = this.conn.transaction('entry', 'readwrite');
  txn.oncomplete = txn_oncomplete.bind(this, ids, resolve, stats);
  txn.onerror = _ => reject(txn.error);

  const store = txn.objectStore('entry');
  const request = store.openCursor();
  request.onsuccess = request_onsuccess.bind(this, ids, stats);
}

function request_onsuccess(ids, stats, event) {
  const cursor = event.target.result;
  if (cursor) {
    stats.visited_entry_count++;

    const entry = cursor.value;
    if (!entry.urls || !entry.urls.length) {
      this.console.debug(
          '%s: deleting entry %d', db_remove_lost_entries.name, entry.id);
      cursor.delete();
      ids.push(entry.id);
    }

    cursor.continue();
  }
}

function txn_oncomplete(ids, callback, stats, event) {
  this.console.debug(
      '%s: scanned %d, deleted %d', db_remove_lost_entries.name,
      stats.visited_entry_count, ids.length);

  const message = {type: 'entry-deleted', id: 0, reason: 'lost'};
  for (const id of ids) {
    message.id = id;
    this.channel.postMessage(message);
  }

  callback();
}
