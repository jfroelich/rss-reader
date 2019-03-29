import Connection from '/src/db/connection.js';
import Feed from '/src/db/feed.js';
import * as identifiable from '/src/db/identifiable.js';
import assert from '/src/lib/assert.js';

export default function delete_feed(conn, feed_id, reason) {
  return new Promise((resolve, reject) => {
    assert(conn instanceof Connection);
    assert(identifiable.is_valid_id(feed_id));

    const entry_ids = [];

    const txn = conn.conn.transaction(['feeds', 'entries'], 'readwrite');
    txn.onerror = event => reject(event.target.error);
    txn.oncomplete = transaction_oncomplete.bind(
        txn, conn.channel, feed_id, reason, entry_ids, resolve);

    txn.objectStore('feeds').delete(feed_id);

    const entry_cursor_request = txn.objectStore('entries').openCursor();
    entry_cursor_request.onsuccess = entry_cursor_request_onsuccess.bind(
        entry_cursor_request, feed_id, entry_ids);
  });
}

// Walk the entries store looking for entries that match the given feed id
// and enqueue delete requests on those entries. The ids of deleted entries are
// appended into the entry_ids array.
function entry_cursor_request_onsuccess(feed_id, entry_ids, event) {
  const cursor = event.target.result;
  if (cursor) {
    const entry = cursor.value;
    if (entry.feed === feed_id) {
      entry_ids.push(entry.id);
      cursor.delete();
    }

    cursor.continue();
  }
}

function transaction_oncomplete(
    channel, feed_id, reason, entry_ids, callback, event) {
  if (channel) {
    channel.postMessage({type: 'feed-deleted', id: feed_id, reason: reason});
    for (const id of entry_ids) {
      channel.postMessage(
          {type: 'entry-deleted', id: id, reason: reason, feed_id: feed_id});
    }
  }

  callback(entry_ids);
}
