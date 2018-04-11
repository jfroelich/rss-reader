The `rdr_mark_entry_read` function marks the entry corresponding to the entry_id as read in the database.

### Params
* @param conn {IDBDatabase} required
* @param channel {BroadcastChannel} optional
* @param entry_id {Number} required

### Impl note on why this throws instead of rejects on bad input
Rather than reject from within the promise, throw an immediate error. This constitutes a serious and permanent programmer error.

### Implementation note on why this uses txn completion over request completion
The promise settles based on the txn, not the get request, because we do some post-request operations, and because there is actually more than one request involved

### TODO: Review use of try/catch around channel.postMessage
Maybe the try/catch isn't needed around channel.postMessage? If `mark_entry_read` is called unawaited, then who cares if the rejection occurs? And when called awaited, it is extremely unlikely the channel has been closed and moreover it probably signals an actual error of premature channel close. I am going to wait on reviewing this further until I resolve the new non-auto-connect requirement in which `mark_entry_read` is called

### Moves old notes from feed-ops docs
* review http://www.micheltriana.com/blog/2012/04/09/library-oriented-architecture
* I would prefer this to not be awaited, but I need to defer the badge update call until after it resolves. I suppose I could use a promise?

### misc unorganized notes from within old body
* Call unawaited. We can still pass conn because the update starts in the current tick, which is prior to conn closing externally, because we know conn is open or else call to `rdr_mark_entry_read` would have failed. Actually, we don't. We await above, so it is entirely possible the connection is closed by now?
* Now that I think about it, might be transactional consistency. Except that in this case consistency doesn't matter because a count of objects in a store is unrelated to any single CRUD operation exclusively, it is related to any of them, the only thing that matters is that the count happens after.
* This is not awaited because we don't care when this returns. We cannot do anything about an error either so it is simply logged. We return prior to this completing. By not blocking until this completes, we can quickly move on to other work.
