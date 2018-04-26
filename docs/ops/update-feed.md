The `write_feed` operation creates or updates a feed in the database, and broadcasts a *feed-updated* type message to the channel when finished. Other than the situation where an options flag is true, this inserts the feed object *as-is*. The input feed object is never modified.

### Context params
All context properties are required.
* **conn** {IDBDatabase} an open database connection
* **channel** {BroadcastChannel} a channel to send messages about a feed being updated
* **console** {object} logging destination

### Params
* **feed** {object} the feed object to store, required, must have the magic type property
* **options** {object} optional, the set of options to specialize the call, see the next section

### Options
* **validate** {Boolean} defaults to false, if true then feed's properties are validated, and the returned promise rejects if the feed is invalid
* **sanitize** {Boolean} defaults to false, if true then the feed is sanitized prior to storage
* **set_date_updated** {Boolean} defaults to false, if true then the feed's `dateUpdated` property is set to the time this function is called

### Return value
`write_feed` is an asynchronous function that returns a promise. The promise return value is the stored feed object.

### Errors
* **TypeError** feed is not a feed type, unlike the other errors this is thrown immediately and not as a promise rejection because making this mistake constitutes a permanent programmer error
* **InvalidStateError** closed channel when calling postMessage, note that internally that channel.postMessage is called *after* the transaction has settled successfully, because it is important to not send out channel messages prematurely in case of transactional failure, meaning that even when this error is thrown the database was still updated, which means that the caller should not necessarily consider this an error, also note that any database error that causes a transactional error means that this will not even attempt to send a message so in other words a database error precludes any channel errors
* **Error** a general error that is thrown when the validate option is true and the input feed is invalid, note that sanitization takes place *before* validation
* **DOMException** database interaction error (notably this is not a DOMError as that was deprecated by whatwg/w3c), will happen with things like a constraint error occurs (such as the one on the urls index), or some kind of strange transactional error, no-space error, database is closed or pending close error

### Implementation note on functional purity
This is a mostly-pure function. Of course it is impure in that the database is permanently modified as a side effect, and a channel message is broadcast. It is pure in the sense that the context and input parameters are never modified.

### Implementation note on setting new id
The result of using `IDBObjectStore.prototype.put` is the keypath of the inserted object,
so here it is always the new feed object's id, regardless of whether the feed is being created or overwritten.

### TODOs
* I am not sure this should reject in the case of attempting to update a feed with invalid properties. Rejections should only occur generally in the case of programmer errors or other serious errors such as a database i/o error, but using invalid data is obviously not a programmer error. What should happen when the feed has invalid properties? For now I am rejecting the promise, but that doesn't sit well with me. I feel like javascript and promises are unfairly hoisting an error pattern on me.
* What if purity isn't worth it and I should just modify the input object in place? On the other hand what is the difference in performance? Maybe this is nitpicking and not worth effort.
