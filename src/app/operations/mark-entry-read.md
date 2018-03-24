The `mark_entry_read` function marks the entry corresponding to the entry_id as read in the database.

* @param conn {IDBDatabase} required
* @param channel {BroadcastChannel} optional
* @param entry_id {Number} required

### TODO: Review use of try/catch around channel.postMessage

Maybe the try/catch isn't needed around channel.postMessage? If `mark_entry_read` is called unawaited, then who cares if the rejection occurs? And when called awaited, it is extremely unlikely the channel has been closed and moreover it probably signals an actual error of premature channel close. I am going to wait on reviewing this further until I resolve the new non-auto-connect requirement in which `mark_entry_read` is called
