
// TODO: after some more thought, maybe this does not belong in the database
// layer at all. Yes, it is only a thin wrapper over a database interaction.
// That is why it is here. But really, this function is a health concern. This
// module is not with operating a generic database. This is not directly
// related to other db modules so it has only minor coherency with them. It
// feels like the same problem as before, where I grouped all the functions that
// dealt with a particular value type together, when in fact those functions
// were all used for different purposes that just happened to share the same
// type. But what I am really going for is learning more about structured
// programming, and modular design. I feel like having this function in its own
// file is a bit of a mistake, but cannot put my finger on the exact reason. I
// tentatively think this might go in some kind of app-health.js module, that is
// concerned with maintaining app health. That module is naive with respect to
// any layering.
//
// Part of the issue is how modules interact with the db. I had the idea that
// things should all pass through a db-layer of some sort. I don't know why.
// Maybe so that it easy to switch database tech underneath and have everything
// still work so long as the API is maintained. At the same time, this module
// does almost nothing more than a database call. And, this module needs to have
// deep integration with the database, because it has to iterate one entry at a
// time, to be scalable.

// TODO: this potentially affects unread count and should be calling
// refresh_badge?
// TODO: test

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
