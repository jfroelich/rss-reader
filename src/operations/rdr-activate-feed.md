Marks a feed as active. This loads the feed, changes its properties, and then saves it again using a single transaction. Once the transaction resolves, a message is sent to the channel. Caller should take care to not close the channel before this settles. If this rejects with an error due to a closed channel, the database transaction has still committed.

### Params

* conn {IDBDatabase} an open database connection, required
* channel {BroadcastChannel} optional, the channel to receive a message about the state change
* feed_id {Number} the id of the feed to modify

### Errors

* database error
* invalid input error
* channel error

### Return value

Returns a promise that resolves to undefined. The promise settles either when an error occurs or when the transaction completes and the channel messages have been posted.
