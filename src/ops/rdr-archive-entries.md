`rdr_archive` transforms certain entries in the reader database with the objective of keeping the size of the database small. Certain entries that are older than a given time period are reduced in byte size.

This compacts rather than deletes so as to keep track of:
* which urls have been visited, so that previously read articles are not re-downloaded and re-presented in the view.
* stats (such as num articles read) because currently stats are setup to be recalculated from scratch, and are not stored in aggregate.

Compacting involves removing several fields from an entry, and in particular, the content field. Once an entry is compacted it is no longer viewable. Only some basic fields remain. The feed-id property remains so that the entry can be removed later when unsubscribing. The urls property remains so to be able to identify the entry. Some date properties are kept for possible later use in generating statistics.

### Context properties
* **conn** {IDBDatabase} an open database connection to the reader database
* **channel** {BroadcastChannel} an open channel, required, which receives messages for each entry that is archived in the form `{type: 'entry-archived', id: entry_id}`
* **console** {object} a console-like object if logging is desired, required, to disable logging consider using a [console-stub](../lib/console-stub/console-stub.js)

### Params
* **max_age** {Number} - in milliseconds, optional, defaults to two days, how old an entry must be based on the difference between the run time and the date the entry was created in order to consider the entry as archivable

### Rejection reasons
* {ReferenceError} when any builtins missing
* {TypeError} invalid inputs
* {DOMException} database errors

### One transaction implementation note
This performs all work using a single transaction. This maintains data integrity. Because the transaction is flagged `readwrite`, and because this function overall, relative to other functions, is long-running, note that it can be a rather obtrusive lock on the entire database.

### Implementation note on using getAll vs cursor
While getAll is substantially faster, it involves loading all data into an array, and therefore does not scale. `rdr_archive` generally runs as a background task so it is not performance sensitive, but it is still somewhat data-size sensitive. Entry objects can be rather large because of the content field. If the number of articles grows very large, using getAll would require loading an absurd amount of data into memory, when in fact that memory does not need to live for very long. So, while using the cursor is slower and involves a ton of stack calls, it scales better. With the cursor, only a limited number of entry objects ever reside in memory at any one point in time.

### Impl note regarding entries presently loaded in view
It is not feasible to track which entries are loaded into a view. Therefore, this interacts with a channel. This sends out a message to the channel each time an entry is archived. If the view also interacts with a channel, it will be notified by message that certain entries were archived, and should be able to react accordingly. The view is better equipped to determine whether a given entry resides in the view. It is not this operation's concern.

### Impl note regarding message-per-entry
There could be potentially many entries archived in any one invocation of the operation. I decided to use one message per entry rather than sending one message per operation. Using one per op would require keeping an array of entry-ids in memory, and would potentially be very large, and therefore not scalable. Instead, I assume the channel implementation is better-equipped to scale to a large number of messages.
