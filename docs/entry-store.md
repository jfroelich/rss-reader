# entry-store
Functions related to storing entries in the database

## archive-entries
Async. Scans the entry store for older entries and archives them. This is an alternative to deleting older entries so as to keep information about which entries have been seen before, and for various statistics. Archiving replaces an entry object with a compacted version, where several properties are removed or reduced in size.

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

## contains-entry
NOTE: this was the doc for find-entry-id-by-url, which is now deprecated, and this doc needs to be updated for contains-entry

The `find_entry_id_by_url` function searches the entry store in the database for an entry that contains the given url. This is not the same as the similarly-named `find_entry_by_url` function (which happens to not exist because there is no need for it at the moment). The important feature here, and part of this operation's namesake and raison-d'etre, is that we get the entry id (the key) from the url index on the entry object store, without deserializing the entry object (loading the object into memory). This operation's primary concern is answering the question of whether an entry with a given url exists, not retrieving the value of an entry.

### Parameters
* conn {IDBDatabase}
* url {URL}

### Errors
* invalid input error (e.g. not a url)
* database error (e.g. connection is closed, database does not exist, bad state)

If awaiting the function then there is no distinction regarding when errors occur. However, if calling unawaited, then there is a distinction. The invalid input error is thrown immediately at the time of the call. Any database errors are not thrown, and instead cause the returned promise to reject.

### Return value
Returns a promise that resolves to the matching entry id {Number}. If no matching entry is found, resolves to undefined.

### Todos
* maybe deprecate and just call update-entry directly

## db-for-each-viewable-entry
Opens a cursor over the entry store for viewable entries starting from the given offset, and iterates up to the given limit, sequentially passing each deserialized entry to the callback. Returns a promise that resolves once all appropriate entries have been iterated. The promise rejects if an error occurs in indexedDB.

### Parameters
* **conn** {IDBDatabase}
* **offset** {Number}
* **limit** {Number}
* **callback** {Function}

### TODOs
* create a `request_onsuccess` helper
* do I want a separate callback for on-all-iterated?

## db-mark-entry-read
Marks an entry as read in the database.

### Context params
* **conn** {IDBDatabase} required
* **channel** {BroadcastChannel} required
* **console** {object} required

### Params
* **entry_id** {Number} required

### Impl note on why this throws instead of rejects on bad input
Rather than reject from within the promise, throw an immediate error. This constitutes a serious and permanent programmer error.

### Implementation note on why this uses txn completion over request completion
The promise settles based on the txn, not the get request, because we do some post-request operations, and because there is actually more than one request involved

### Moves old notes from feed-ops docs
* review http://www.micheltriana.com/blog/2012/04/09/library-oriented-architecture

### TODOs
* refactor as entry_set_read_state, accept a boolean state parameter, and handle both cases (where true and where false)
* or, create db-write-entry-property, have this decorate that, or have the caller just call db-write-entry-property directory
* create a db-write-entry-property module, then use that instead of this. In the interim, can consider refactoring this to basically wrap a call to it, maybe even keep the channel message type the same. Then slowly migrate all callers to call db-write-entry-property directly. This will potentially reduce the number of operations related to entries, and is more forward thinking in case new operations are added later (e.g. star/unstar-entry).


## db-remove-lost-entries
Removes entries missing urls from the database.

### Params
* **conn** {IDBDatabase} an open database connection, optional, if not specified this will auto-connect to the default database
* **channel** {BroadcastChannel} optional, the channel over which to communicate storage change events
* **console** {Object} optional, logging destination, if specified should comply with the window.console interface

### Errors

### Return value

### Implementation notes
Internally this uses openCursor instead of getAll for scalability.

### TODOS
* this potentially affects unread count and should be calling `badge.update`?
* use context
* improve docs
* write tests

## db-remove-orphaned-entries
Scans the database for entries not linked to a feed and deletes them

### Params
* **conn** {IDBDatabase} open database connection
* **channel** {BroadcastChannel} optional, broadcast channel

### TODOS
* improve docs
* write tests
* this potentially affects unread count and therefore should be interacting with `badge.update`
* add console parameter and NULL_CONSOLE impl
* maybe use context
