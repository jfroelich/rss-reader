# entry-store
Functions related to storing entries in the database


## archive-entries
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

## for-each-viewable-entry
Opens a cursor over the entry store for viewable entries starting from the given offset, and iterates up to the given limit, sequentially passing each deserialized entry to the callback. Returns a promise that resolves once all appropriate entries have been iterated. The promise rejects if an error occurs in indexedDB.

### Parameters
* **conn** {IDBDatabase}
* **offset** {Number}
* **limit** {Number}
* **callback** {Function}

### TODOs
* create a `request_onsuccess` helper
* do I want a separate callback for on-all-iterated?

## mark-entry-read
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
* or, create write-entry-property, have this decorate that, or have the caller just call write-entry-property directory

## remove-lost-entries
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

## remove-orphaned-entries
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

## write-entry
Creates or overwrites an entry object in the database.

* If the goal is to create, the `id` property should not exist in the input entry object. Note the difference between an id property set to undefined, and the absence of the property.
* This function is pure in the sense that input is not modified
* This function is impure in the sense that it has side effects: the database is modified and a message is posted to a channel

### Context properties
* **conn** {IDBDatabase} an open database connection
* **channel** {BroadcastChannel} after successful storage a message is posted to the channel
* **console** {Object} logging destination, anything console-like

All properties required.

### Params
* **entry** {object} the entry to update
* **validate** {Boolean} whether to validate the input object, optional, defaults to true

The input entry object must be *structured-cloneable*, which basically means serializable, which basically means it must be a basic object and not a function object. Otherwise this will throw an error when attempting to store the object in indexedDB.

Validation should be performed in nearly all cases except where performance is an issue or the caller is handling validation on its own and wants to avoid redundant processing.

### Errors
* **TypeError** invalid input parameters
* **DOMException** when a database error occurs, such as when using a bad id value, or creating a new entry that shares a url with an existing entry, or the database is closing at the time the transaction is started
* **InvalidStateError** channel is closed when posting message

Beware the following caveat: in the event of a database error the database remains in the state prior to calling `write_entry` because the transaction never commits. However, in the event of a channel post error *the database is still modified*. In other words `write_entry` can fail with an error but still permanently modify the database.

### Channel message properties
* **type** {String} the value 'entry-write'
* **id** {Number} the entry id
* **create** {Boolean} true when entry created, false when updated

### Return value
Returns a promise that resolves to the stored entry object.

Resolution occurs only after the internal transaction commits. In other words this does not use eventual-consistency and prematurely resolve. At least not in Chrome's implementation of indexedDB. I think Firefox does some funky stuff where if the disk fails the transaction still commits because the internal transaction eagerly commits. However, that is in a lower layer, and not something I can do much about.

For created entries, this retrieves the new id generated by indexedDB and sets the id property of the returned entry object.

### Implementation note on return value
This returns the object, not just the id. Earlier implementations returned id. Now that potentially does sanitization, the caller might want access to the modified values. If only the id was returned the caller would not have access and would need to do a followup request. So returning the object avoids this potential second trip to the database.

### Implementation note on result of put in case of update
`IDBObjectStore.prototype.put` still returns the object's key path in the case of a put overwrite. In the case of create it returns the new value resulting from the auto-increment. Therefore it would be harmless to overwrite the returned object's id in the case the impl also decided to set the id on update and not just create. However, there is the minor performance benefit of not binding the request listener for case of update. So by not binding it precludes even the possibility of any concern happening to the overwriting the object id to something unexpected. But, in previous implementations it did not, and this question of what put returns for update was a thing about indexedDB that I keep forgetting, so keeping this note around.

### TODOs
* Validation shouldn't throw an exception. Data is routinely bad. Bad data is not a program error. Exceptions should be reserved for programming errors. But what else is there to do in this case? And which module or step in the entry-processing-pileine is responsible for ensuring the input data is ever good? How do I differentiate between code earlier in the execution path being poorly written, and bad data?
* If I plan to have validation also occur in `sanitize_entry`, then I think what should happen here is that I pass a `validate` flag (boolean, set to false) along to `sanitize_entry` to avoid revalidation because it could end up being a heavier operation, basically I am undecided about where validation should occur, and if I end up doing validation in multiple places I am concerned about redundant validation. If I add validation to sanitize, I could just forward the flag. But there is a problem there, because I do not do sanitization in the case of an update, only in the case of create. The hierarchy of conditions grows a bit and may be too deep.
* It is possible this would be better implemented if it was not concerned with validation or sanitization at all. I think it might be an anti-pattern.

Regarding above, consider the following code:

```
function first_caller() {
  foo();
  bar();
}

function second_caller() {
  const do_foo = true;
  bar(do_foo);
}

function foo() {}

function bar(do_foo) {
  if(do_foo) {
    foo();
  }

  ...
}
```

Basically the `do_foo` flag is dumb. The caller can decide whether foo should occur simply by either calling it or not calling it. Then bar is no longer concerned with whether foo occurs. Basically the bar(do_foo) implementation is abusing flag parameters to decide the flow of execution. Flag parameters should probably generally not decide execution flow. Instead the caller decides this, both explicitly and implicity, by the presence or absence of the foo call preceding bar.

The fact that `do_foo` is boolean, meaning that it *could* be false some of the time, means it is optional. This means foo is not tightly coupled with bar, from a sequence-of-operations perspective. In other words the presence of bar does not imply foo. That is strong evidence that do_foo is bad as a parameter.

Removing `do_foo` removes the concern from bar about whether foo occurs. bar is free to concern itself with only its purpose and it becomes simpler. This is particularly true in the case where foo is optional and doesn't really affect bar's logic, just its flow.

Again, go back to the idea of composable functions. The caller can choose to compose foo and bar by calling foo then calling bar. If do_foo is a parameter, then the caller can still compose but is forced to do so via parameter instead of by explicit call. So it is almost like I am ignoring the built in freedom of the language. This seems universal, so it really seems like a violation of a basic programming rule.

Another idea. What if I pass a function instead of a flag. So the write-entry function takes a validate-entry function as input. If the caller doesn't want validation, they pass in noop. In that case validation becomes less of a parameter and more of a context property, so I think it would be worthy of elevating to context. That and whether to validate or not does not vary within the same context. If the caller wants varied behavior they could use multiple contexts in that case. The thing is, this idea is basically the same problem all over again.
