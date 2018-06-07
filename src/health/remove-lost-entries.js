// TODO: this potentially affects unread count and should be calling
// refresh_badge?
// TODO: implement tests

// Removes entries missing urls from the database.
// @param conn {IDBDatabase} an open database connection, optional, if not
// specified this will auto-connect to the default database
// @param channel {BroadcastChannel} optional, the channel over which to
// communicate storage change events
export function remove_lost_entries(conn, channel) {
  return new Promise(executor.bind(null, conn, channel));
}

function executor(conn, channel, resolve, reject) {
  const ids = [];
  const stats = {visited_entry_count: 0};
  const txn = conn.transaction('entry', 'readwrite');
  txn.oncomplete = txn_oncomplete.bind(txn, channel, ids, resolve, stats);
  txn.onerror = _ => reject(txn.error);

  // Use openCursor instead of getAll for scalability.
  const store = txn.objectStore('entry');
  const request = store.openCursor();
  request.onsuccess = request_onsuccess.bind(request, ids, stats);
}

function request_onsuccess(ids, stats, event) {
  const cursor = event.target.result;
  if (cursor) {
    stats.visited_entry_count++;

    const entry = cursor.value;
    if (!entry.urls || !entry.urls.length) {
      cursor.delete();
      ids.push(entry.id);
    }

    cursor.continue();
  }
}

function txn_oncomplete(channel, ids, callback, stats, event) {
  const message = {type: 'entry-deleted', id: 0, reason: 'lost'};
  for (const id of ids) {
    message.id = id;
    channel.postMessage(message);
  }

  callback();
}
