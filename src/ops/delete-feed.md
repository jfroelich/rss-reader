The `delete_feed` operation removes a feed, and any entries tied to the feed, from the database.

* Returns a promise that resolves when the operation has completed, the promise return value is an array of the deleted entry ids
* The operation resolves once the internal database transaction has committed.
* A message is sent to the channel when the feed is deleted
* A message is sent to the channel when an entry is deleted
* Messages are not sent prematurely, messages are only sent when the transaction has actually committed successfully
* If an error occurs then the returned promise rejects
* If the input feed-id is invalid (not well-formed) this throws an exception immediately
* This never actually checks if the feed exists, it just deletes whatever feed object corresponds to the given id, if it exists, because it just calls `store.delete` internally, which according to the indexedDB API settles successfully regardless of whether there was an actual state change.

### Params

* conn {IDBDatabase} an open database connection
* channel {BroadcastChannel} optional, will send messages when the feed is deleted and for each entry deleted
* console {console object} optional, if specified then some helpful debug messages are printed to the console
* feed_id {Number} the feed to delete
* reason_text {String} optional, a categorical description of the reason for deletion, such as 'unsubscribe', or 'inactive'

### Misc implementation notes

* This uses a single database transaction to guarantee data integrity
* This uses getAllKeys rather than getAll when finding and iterating over entries for a feed in order to avoid unnecessary deserialization of entries

### Implementation note on updating unread count

Deleting (unsubscribing) from a feed may have deleted one or more entries that were in the unread state and were contributing to the total unread count, so the badge text is out of date.

Because the call to `rdr_badge_refresh` is un-awaited it will still be pending at time of resolution of delete_feed.

### TODOS
* get conn from event rather than from parameter in `txn_oncomplete`
* there are lots of params being passed to helper, consider using some kind of context object for shared variables, this would also enable the non-inlining of the getAllKeys success handler function which currently must be inlined because of its reference modification
* there are lots of params, consider a params object
* consider de-optimizing by removing the feed index from the entry store. Deletes are rare events. There is not a great need for this operation to be fast. Maintaining the feed index on the entry store is expensive. What else relies on the feed index? Rather than finding entries for the feed by querying the feed index this could simply walk the entire entry store, one entry at a time.
