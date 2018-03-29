`rdr_archive` transforms certain entries in the reader database with the objective of keeping the size of the database small. Certain entries that are older than a given time period are compacted.

This compacts rather than deletes. Entries need to stick around for the following reasons:
* To keep track of which urls have been visited, so that previously read articles are not re-downloaded and re-presented in the view.
* To keep track of stats (e.g. num articles read) because currently stats are setup to be recalculated from scratch, and are not stored in aggregate.

### Params

* conn {IDBDatabase} an open database connection to the reader database
* channel {BroadcastChannel} an open channel, optional, which receives messages for each entry that is archived in the form `{type: 'entry-archived', id: entry_id}`
* console {object} a console object if logging is desired, optional
* max_age {Number} - in milliseconds, optional, defaults to two days, how old an entry must be based on the difference between the run time and the date the entry was created in order to consider the entry as archivable

### Errors

* Reference errors if any builtins not available
* Type errors for invalid inputs
* Database errors

### One transaction

This performs all work using a single transaction. This maintains data integrity. Because the transaction is flagged `readwrite`, and because this function overall, relative to other functions, is long-running, note that it can be a rather obtrusive lock on the entire database.

### A note on using getAll vs cursor

While getAll is substantially faster, it does not scale. `rdr_archive` generally runs as a background task so it is not performance sensitive, but it is still somewhat data-size sensitive. Entry objects can be rather large because of the content field. getAll would involve loading all objects in the database into memory. If the number of articles grows very large, using getAll would require loading an absurd amount of data into memory, when in fact that memory does not need to live for very long. So, while using the cursor is slower and involves a ton of stack calls, it scales better. With the cursor, only a limited number of entry objects ever reside in memory at any one point in time.
