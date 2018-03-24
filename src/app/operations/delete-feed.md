The `delete_feed` operation remove a feed any entries tied to the feed from the database

### Params

* conn {IDBDatabase}
* channel {BroadcastChannel} optional
* feed_id {Number}
* reason_text {String}

### TODOS
* there are lots of params being passed to helper, consider using some kind of context object for shared variables, this would also enable the non-inlining of the getAllKeys success handler function which currently must be inlined because of its reference modification
* there are lots of params, consider a params object
* consider deoptimizing by removing the feed index from the entry store. Deletes are rare events. There is not a great need for this operation to be fast. Maintaining the feed index on the entry store is expensive. What else relies on the feed index? Rather than finding entries for the feed by querying the feed index this could simply walk the entire entry store, one entry at a time.
* make logging optional, use the null_console pattern, add console as a parameter, probably should be logging a bit more for that matter
