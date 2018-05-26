import {refresh_badge} from '/src/badge.js';
import {is_valid_feed_id} from '/src/feed.js';

/*
# delete-feed
Removes a feed, and any entries tied to the feed, from the database.

Notes:
* Returns a promise that resolves when the operation has completed, the promise
return value is an array of the deleted entry ids
* The operation resolves once the internal database transaction has committed.
* A message is sent to the channel when the feed is deleted
* A message is sent to the channel when an entry is deleted
* Messages are not sent prematurely, messages are only sent when the transaction
has actually committed successfully
* If an error occurs then the returned promise rejects
* If the input feed-id is invalid (not well-formed) this throws an exception
immediately
* This never actually checks if the feed exists, it just deletes whatever feed
object corresponds to the given id, if it exists, because it just calls
`store.delete` internally, which according to the indexedDB API settles
successfully regardless of whether there was an actual state change.
* This does not validate that `reason_text` param is a string or defined
* If an error occurs when posting a message to the channel, the returned promise
rejects with an error, but the transaction has still committed and the database
was modified

### Context params
* **conn** {IDBDatabase} an open database connection
* **channel** {BroadcastChannel} will send messages when the feed is deleted and
for each entry deleted
* **console** {object} logging destination, typically `console` or a console
stub

All required

### Params
* **feed_id** {Number} the feed to delete
* **reason_text** {String} optional, a categorical description of the reason for
deletion, such as 'unsubscribe', or 'inactive'

### Errors
* **TypeError** if the input feed id is invalid
* **Rejection errors** database i/o errors as DOMException, InvalidStateError if
channel is closed at time of call to postMessage

### Return value
Returns a promise that resolves to an array of the entry ids that were deleted.
The array is always defined but may be zero-length.

### Misc implementation notes
* This uses a single database transaction to guarantee data integrity. If
deleting an entry for a feed causes an error after the feed was deleted, the
feed is not actually deleted.
* This uses getAllKeys rather than getAll when finding and iterating over
entries for a feed in order to avoid unnecessary deserialization of entries

### Implementation note on updating unread count
Deleting (unsubscribing) from a feed may have deleted one or more entries that
were in the unread state and were contributing to the total unread count, so the
badge text is out of date, so this refreshes the badge. Because the call to
`refresh_badge` is un-awaited it will still be pending at time of resolution of
db_delete_feed. The database connection can still be closed immediately on
resolution of the outer promise because the refresh call occurs in the same
tick, before the close-pending flag has been set, and
IDBDatabase.prototype.close can be called while transactions are still pending
(they still settle, the close call just waits).

### TODOS
* Should get conn from event rather than from parameter in `txn_oncomplete`
* Should consider de-optimizing by removing the feed index from the entry store.
Deletes are rare events. There is not a great need for this operation to be
fast. Maintaining the feed index on the entry store is expensive. What else
relies on the feed index? Rather than finding entries for the feed by querying
the feed index this could simply walk the entire entry store, one entry at a
time.

*/

export function db_delete_feed(feed_id, reason_text) {
  if (!is_valid_feed_id(feed_id)) {
    throw new TypeError('Invalid feed id ' + feed_id);
  }

  return new Promise(delete_feed_executor.bind(this, feed_id, reason_text));
}

function delete_feed_executor(feed_id, reason_text, resolve, reject) {
  let entry_ids = [];
  const txn = this.conn.transaction(['feed', 'entry'], 'readwrite');
  txn.oncomplete = delete_feed_txn_oncomplete.bind(
      this, feed_id, reason_text, entry_ids, resolve);
  txn.onerror = _ => reject(txn.error);

  const feed_store = txn.objectStore('feed');

  // Delete the feed
  this.console.debug('Deleting feed with id', feed_id);
  feed_store.delete(feed_id);

  // Delete all entries belonging to the feed
  const entry_store = txn.objectStore('entry');
  const feed_index = entry_store.index('feed');

  // TODO: use openKeyCursor for scalability?
  const request = feed_index.getAllKeys(feed_id);
  request.onsuccess = event => {
    const keys = request.result;

    for (const id of keys) {
      entry_ids.push(id);
      this.console.debug('%s: deleting entry %d', db_delete_feed.name, id);
      entry_store.delete(id);
    }
  };
}

function delete_feed_txn_oncomplete(
    feed_id, reason_text, entry_ids, callback, event) {
  const msg = {type: 'feed-deleted', id: feed_id, reason: reason_text};
  this.console.debug('%s: %o', db_delete_feed.name, msg);
  this.channel.postMessage(msg);

  msg.type = 'entry-deleted';
  for (const id of entry_ids) {
    msg.id = id;
    this.channel.postMessage(msg);
  }

  refresh_badge(this.conn, this.console).catch(this.console.error);
  callback(entry_ids);
}
