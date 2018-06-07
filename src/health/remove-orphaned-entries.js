import {is_entry} from '/src/entry.js';
import {is_valid_feed_id} from '/src/feed.js';

// TODO: this potentially affects unread count and should be calling
// refresh_badge?

// TODO: implement tests

// Scans the database for entries not linked to a feed and deletes them
// @param conn {IDBDatabase} open database connection
// @param channel {BroadcastChannel} optional, broadcast channel
export function remove_orphaned_entries(conn, channel) {
  return new Promise(executor.bind(null, conn, channel));
}

function executor(conn, channel, resolve, reject) {
  // Maintain a buffer of deleted entry ids so that it is available after the
  // transaction commits for use by operations that should not occur until
  // after the commit.
  const entry_ids = [];

  const txn = conn.transaction(['feed', 'entry'], 'readwrite');
  txn.oncomplete = txn_oncomplete.bind(txn, channel, entry_ids, resolve);
  txn.onerror = _ => reject(txn.error);

  // Query for all feed ids. We load just the ids so that it is faster and more
  // scalable than actually loading all feed info.

  // Note that control is continued in the callback. It would be nice to use
  // promise syntax here to keep control in the same function body, but the
  // problem is that using a promise introduces a microtask delay in the midst
  // of using indexedDB. indexedDB transactions can timeout when no requests are
  // detected, and the initial micro-delay may be just enough to let the timeout
  // occur. I think.

  const feed_store = txn.objectStore('feed');
  const request = feed_store.getAllKeys();
  request.onsuccess = get_feeds_request_onsuccess.bind(request, entry_ids);
}

function get_feeds_request_onsuccess(entry_ids, event) {
  // Get the array of loaded feed ids. I think feed_ids will always be defined
  // even in the case of an empty feed store, but I am not entirely sure.
  const feed_ids = event.target.result || [];

  // By not enqueuing more requests this will let the transaction eventually
  // timeout and the outer promise will resolve faster than when we enqueue
  // another request knowing that request will be pointless.
  if (!feed_ids.length) {
    return;
  }

  // Get a reference to the transaction used by the get-feed-ids request, we
  // will continue to use this same transaction (and not start another).
  const txn = event.target.transaction;

  // Start iterating over all entries in the database
  const store = txn.objectStore('entry');
  const request = store.openCursor();
  request.onsuccess = entry_cursor_onsuccess.bind(request, feed_ids, entry_ids);
}

// Handle the advancement of the entry-store cursor to an entry.
function entry_cursor_onsuccess(feed_ids, entry_ids, event) {
  const cursor = event.target.result;
  if (!cursor) {
    // All entries iterated or no entries found
    return;
  }

  const entry = cursor.value;

  // If the loaded entry is invalid based on its magic type, ignore it and
  // continue. This represents an unhealthy entry but for a different reason and
  // is not our concern. It does mean the database is corrupted, but it might
  // only be partially corrupted. If we did not check, then this would still be
  // an implied assumption of later checks, so I like that it is explicit.
  if (!is_entry(entry)) {
    cursor.continue();
    return;
  }

  // If the entry has a valid feed id, ignore it and continue.
  if (is_valid_feed_id(entry.feed)) {
    cursor.continue();
    return;
  }

  // If the entry's feed id is a known feed id, ignore it and continue.
  if (feed_ids.includes(entry.feed)) {
    cursor.continue();
    return;
  }

  // We found an entry with a bad feed id. Record that it will be deleted once
  // the transaction commits, request its deletion, and continue.
  entry_ids.push(entry.id);
  cursor.delete();
  cursor.continue();
}

function txn_oncomplete(channel, entry_ids, callback, event) {
  const message = {type: 'entry-deleted', id: 0, reason: 'orphan'};
  for (const id of entry_ids) {
    message.id = id;
    channel.postMessage(message);
  }

  callback();
}
