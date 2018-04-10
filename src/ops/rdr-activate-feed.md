Marks a feed as active. This loads the feed, changes its properties, and then saves it again using a single transaction. Once the transaction resolves, a message is sent to the channel. Caller should take care to not close the channel before this settles. If this rejects with an error due to a closed channel, the database transaction has still committed.

### Context params
* conn {IDBDatabase} an open database connection
* channel {BroadcastChannel} the channel to receive a message about the state change
* console {object} the logging destination

All context parameters are required

### Params
* feed_id {Number} the id of the feed to activate

### Errors
* database error - if something goes wrong modifying the database
* invalid input error - if context or params invalid
* channel post message error - if channel is closed when posting message

### Return value
Returns a promise that resolves to undefined. The promise settles either when an error occurs or when the transaction completes and the channel messages have been posted.