import {refresh_badge} from '/src/badge.js';
import {is_valid_feed_id} from '/src/feed.js';
import {log} from '/src/log.js';

// Removes a feed, and any entries tied to the feed, from the database. The
// operation resolves once the internal database transaction has committed. A
// message is sent to the channel when the feed is deleted, and when an entry is
// deleted. This never actually checks if the feed exists.

// Required context properties
// * conn {IDBDatabase} an open database connection
// * channel {BroadcastChannel} will send messages when the feed is deleted
// and for each entry deleted

// @param feed_id {Number} the feed to delete
// @param reason_text {String} optional, a categorical description of the reason
// for deletion, such as 'unsubscribe', or 'inactive', this parameter is not
// sanity checked
// @throws {TypeError} if the input feed id is invalid, this is thrown immediately
// unlike the promise rejections
// @rejects {DOMException} database errors
// @rejects {InvalidStateError} if channel is closed when posting message, but
// note that db still modified
// @return {Promise} a promise that resolves to an array of the entry ids that
// were deleted. The array is always defined but may be zero-length.

export function db_delete_feed(feed_id, reason_text) {
  if (!is_valid_feed_id(feed_id)) {
    throw new TypeError('Invalid feed id ' + feed_id);
  }

  return new Promise(delete_feed_executor.bind(this, feed_id, reason_text));
}

function delete_feed_executor(feed_id, reason_text, resolve, reject) {
  let entry_ids = [];

  // This uses a single database transaction to guarantee data integrity. If
  // deleting an entry for a feed causes an error after the feed was deleted,
  // the feed is not actually deleted.
  const txn = this.conn.transaction(['feed', 'entry'], 'readwrite');
  txn.oncomplete = delete_feed_txn_oncomplete.bind(
      this, feed_id, reason_text, entry_ids, resolve);
  txn.onerror = _ => reject(txn.error);

  const feed_store = txn.objectStore('feed');

  // Delete the feed
  log('Deleting feed with id', feed_id);
  feed_store.delete(feed_id);

  // Delete all entries belonging to the feed
  // TODO: should consider de-optimizing by removing the feed index from the
  // entry store. Deletes are rare events. There is not a great need for this
  // operation to be fast. Maintaining the feed index on the entry store is
  // expensive. What else relies on the feed index? Rather than finding entries
  // for the feed by querying the feed index this could simply walk the entire
  // entry store, one entry at a time.

  const entry_store = txn.objectStore('entry');
  const feed_index = entry_store.index('feed');

  // This uses getAllKeys rather than getAll when finding and iterating over
  // entries for a feed in order to avoid unnecessary deserialization of entries
  // TODO: use openKeyCursor for scalability?

  const request = feed_index.getAllKeys(feed_id);

  // TODO: do not nest
  request.onsuccess = event => {
    const keys = request.result;

    for (const id of keys) {
      entry_ids.push(id);
      log('%s: deleting entry %d', db_delete_feed.name, id);
      entry_store.delete(id);
    }
  };
}

function delete_feed_txn_oncomplete(
    feed_id, reason_text, entry_ids, callback, event) {
  // Messages are not sent prematurely, messages are only sent when the
  // transaction has actually committed successfully

  const msg = {type: 'feed-deleted', id: feed_id, reason: reason_text};
  log('%s: %o', db_delete_feed.name, msg);
  this.channel.postMessage(msg);

  msg.type = 'entry-deleted';
  for (const id of entry_ids) {
    msg.id = id;
    this.channel.postMessage(msg);
  }

  // Deleting a feed may have deleted one or more entries that were in the
  // unread state and were contributing to the total unread count, so the badge
  // text is out of date, so this refreshes the badge. Because the call to
  // `refresh_badge` is un-awaited it will still be pending at time of
  // resolution of db_delete_feed. The database connection can still be closed
  // immediately on resolution of the outer promise because the refresh call
  // occurs in the same tick, before the close-pending flag has been set, and
  // IDBDatabase.prototype.close can be called while transactions are still
  // pending (they still settle, the close call just waits).
  // TODO: should this not be a concern? should it instead be the caller's
  // concern? As in, the concern of some outer layer? I do not love how this
  // has a sort of circular dependency between layers

  // TODO: should get conn from event rather than from context? This is
  // stylistic issue and I do not know which is better

  refresh_badge(this.conn).catch(log);

  // TODO: if entry ids are posted to the channel then resolving with this
  // array is redundant. It would be better then to resolve with undefined.

  callback(entry_ids);
}
