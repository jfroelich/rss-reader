import {refresh_badge} from '/src/badge.js';
import {is_valid_feed_id} from '/src/feed.js';

// Asynchronously removes a feed, and any entries associated with the feed, from
// the database. The operation resolves once the sole internal database
// transaction commits. A message is sent to the channel when the feed is
// deleted, and for each associated entry that is deleted.
//
// Calling this on a well-formed feed id that does not point to an existing feed
// in the database is a noop.
//
// @param conn {IDBDatabase} an open database connection
// @param channel {BroadcastChannel} receives messages when the feed is
// deleted and for each entry deleted
// @param feed_id {Number} the id of the feed to delete
// @param reason {String} optional, a categorical description of the reason
// for deletion, not sanity checked
// @throws {TypeError} invalid parameters
// @throws {DOMException} database errors
// @throws {InvalidStateError} if channel is closed when posting message, but
// note that db still modified
// @return {Promise} resolves to undefined
export function delete_feed(conn, channel, feed_id, reason) {
  return new Promise(executor.bind(null, conn, channel, feed_id, reason));
}

function executor(conn, channel, feed_id, reason, resolve, reject) {
  // Avoid misleading behavior
  if (!is_valid_feed_id(feed_id)) {
    throw new TypeError('Invalid feed id ' + feed_id);
  }

  const entry_ids = [];
  const txn = conn.transaction(['feed', 'entry'], 'readwrite');
  txn.oncomplete = txn_oncomplete.bind(
      txn, conn, channel, feed_id, reason, entry_ids, resolve);
  txn.onerror = _ => reject(txn.error);

  const feed_store = txn.objectStore('feed');
  feed_store.delete(feed_id);

  // We do not need to load full entries, just keys
  const entry_store = txn.objectStore('entry');
  const feed_index = entry_store.index('feed');
  const request = feed_index.getAllKeys(feed_id);
  request.onsuccess = request_onsuccess.bind(request, entry_ids, entry_store);
}

function request_onsuccess(entry_ids, entry_store, event) {
  const keys = event.target.result;
  for (const id of keys) {
    entry_ids.push(id);
    entry_store.delete(id);
  }
}

function txn_oncomplete(
    conn, channel, feed_id, reason, entry_ids, callback, event) {
  const feed_msg = {};
  feed_msg.type = 'feed-deleted';
  feed_msg.id = feed_id;
  feed_msg.reason = reason;
  channel.postMessage(feed_msg);

  const entry_msg = {};
  entry_msg.type = 'entry-deleted';
  entry_msg.id = 0;
  entry_msg.reason = reason;
  entry_msg.feed_id = feed_id;  // retain correspondence
  for (const id of entry_ids) {
    entry_msg.id = id;
    channel.postMessage(entry_msg);
  }

  refresh_badge(conn).catch(console.error);

  callback();
}
