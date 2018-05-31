import {log} from '/src/log.js';

// ## db-remove-lost-entries
// Removes entries missing urls from the database.
// ### Params
// * **conn** {IDBDatabase} an open database connection, optional, if not
// specified this will auto-connect to the default database
// * **channel** {BroadcastChannel} optional, the channel over which to
// communicate storage change events

// ### Errors

// ### Return value

// ### Implementation notes
// Internally this uses openCursor instead of getAll for scalability.

// ### TODOS
// * this potentially affects unread count and should be calling `badge.update`?
// * use context
// * improve docs
// * write tests

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
      log('%s: deleting entry %d', db_remove_lost_entries.name, entry.id);
      cursor.delete();
      ids.push(entry.id);
    }

    cursor.continue();
  }
}

function txn_oncomplete(ids, callback, stats, event) {
  log('%s: scanned %d, deleted %d', db_remove_lost_entries.name,
      stats.visited_entry_count, ids.length);

  const message = {type: 'entry-deleted', id: 0, reason: 'lost'};
  for (const id of ids) {
    message.id = id;
    this.channel.postMessage(message);
  }

  callback();
}
