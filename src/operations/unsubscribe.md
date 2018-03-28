Remove a feed and its entries from the database

### Params

* conn {IDBDatabase} an open database connection, required
* channel {BroadcastChannel} optional, this dispatches feed deleted and entry deleted messages to the given channel
* feed_id {Number} id of feed to unsubscribe

### TODOs

* this shouldn't be dependent on badge.update, it should be the other way around. See notes in badge.js. There is a chance there is no need to call it here. In which case, unsubscribe devolves into merely an alias of `delete_feed`, and for that matter, the caller can just call `delete_feed` directly, and I could also consider renaming `delete_feed` to `unsubscribe`.
* actually, see what i did with deprecating mark-read when moving to syscalls api pattern. it is ok to use badge. so in really this should be entirely deprecated, the badge update should be moved into the delete feed call, caller should call delete feed directly. and for that matter i should consider renaming `delete_feed` to `unsubscribe`
