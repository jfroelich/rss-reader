The `rdr_mark_entry_read` function marks the entry corresponding to the entry_id as read in the database.

### Context params
* conn {IDBDatabase} required
* channel {BroadcastChannel} required
* console {object} required

### Params
* entry_id {Number} required

### Impl note on why this throws instead of rejects on bad input
Rather than reject from within the promise, throw an immediate error. This constitutes a serious and permanent programmer error.

### Implementation note on why this uses txn completion over request completion
The promise settles based on the txn, not the get request, because we do some post-request operations, and because there is actually more than one request involved

### Moves old notes from feed-ops docs
* review http://www.micheltriana.com/blog/2012/04/09/library-oriented-architecture
