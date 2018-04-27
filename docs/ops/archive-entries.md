# archive-entries
Async. Scans the entry store for older entries and archives them. This is a viable alternative to deleting older entries so as to keep information about which entries have been seen before, and for various statistics. Archiving is done by replacing an entry object with a compacted version, where several properties are removed or reduced in size.

### Context properties
* **conn** {IDBDatabase} an open database connection to the reader database
* **channel** {BroadcastChannel} an open channel to which to post messages
* **console** {console-like-object} logging destination

All context properties are required

### Params
* **max_age** {Number} in milliseconds, optional, defaults to two days, how old an entry must be based on the difference between the run time and the date the entry was created in order to consider the entry as archivable

### Errors
* **TypeError** invalid inputs, such as invalid max-age parameter value
* **DOMException** database errors, such as database not open, database close pending, transaction failure, store missing
* **InvalidStateError** if the channel is closed at the time messages are sent to the channel

### Return value
Returns a promise that resolves to an array of entry ids that were archived.

### Channel message format
Messages are basic objects with properties:
* **type** {String} entry-archived
* **id** {Number} entry id

### Implementation note regarding database transactions
* This uses one transaction. Using one transaction ensures data integrity.
* This involves a rather obtrusive lock on the entire database because the transaction involves writing and is relatively long-running.

### Implementation note regarding how entries are selected
Rather than load only those entries that should be archived, this loads entries that have some properties needed for archivability but are not necessarily archivable. This is largely due to the complexities of using a multipart key path for an index in indexedDB. Therefore this loads more entries than needed. I may in the future look into optimizing this aspect, and making it more correct. For now I am leaving it this way given this is intended to run untimed.

### Implementation note on using getAll vs cursor
This uses a cursor to walk entries instead of getAll. While `getAll` is faster, `getAll` loads the entire store at once, and therefore does not scale. This operation generally runs in the background so it is not performance sensitive, but it is still data-size sensitive. Entry objects can be rather large because of the content field. While using the cursor is slower and involves a ton of stack calls, it scales better. With the cursor, only a limited number of entry objects ever reside in memory at any one point in time.

### Implementation note regarding entries presently viewable
Tracking viewable entries is possible but not very feasible. Therefore, this interacts with a channel. This sends out a message to the channel each time an entry is archived. If the view also interacts with a channel, it will be notified that certain entries were archived, and should be able to react accordingly. The view is better equipped to dynamically determine whether a given entry resides in the view and decide how to react. Therefore, whether an entry is currently viewable is not this operation's concern.

### Implementation note regarding messages and transaction state
Channel messages are not posted until *after* the transaction completes successfully. In other words, messages are not posted prematurely and do not assume the transaction will be successful, to avoid having callers develop a false reliance on the state of the database. Posting a message to the channel may cause an invalid state error if the channel is closed. This will cause the operation to reject with an error. However, by this point the transaction was committed. Therefore it is possible for this function to throw an error yet still permanently modify state.

### Implementation note regarding batch message posting
This sends one message to the channel per entry archived, rather than sending a single message containing an array of archived entry ids. The number of archived entries can be very large. Sending very large messages is discouraged. This assumes that BroadcastChannels are better tuned for sending a large number of small messages than a small number of large messages.

### Todos
* There is probably no need to resolve to array of entry ids. That information is available via the channel, so the return value is redundant. It feels like the return value is an unstable part of the api. It would more stable if I just denied access to it and changed this to a void function. I do not believe any callers rely on the return value.
