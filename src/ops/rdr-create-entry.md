The `rdr_create_entry` function creates a new entry within the reader database.

Internally, the entry object is cloned before being stored. In other words, this is a *pure function*, apart from the permanent database modification side-effect, because none of the inputs are modified. The entry object must be structured-cloneable, as in, serializable.

The input object should not have an `id` property set; if it does then an error is thrown. The property should not exist in the input entry object. In the output entry object, it will have a new id property set.  The id is set according to the database's auto-increment algorithm. In general an entry id is a positive integer greater than 0.

### Content properties
* conn {IDBDatabase} an open database connection
* channel {BroadcastChannel} a channel to notify with a message when the entry is stored
* console {object} logging destination

### Params
* entry {object} the entry object to store
* validate {Boolean} whether to validate the object before storing

### Errors
* DOMException - when a database error occurs
* TypeError - invalid inputs
* InvalidStateError - channel is closed when posting message

In the event of a database error the database stays in the state prior to the call. However in the event of a channel post error the database is still modified.

### Return value
Returns a promise that resolves to the stored entry object. Resolution occurs after the new object has been stored.

### Impl internal notes
* Delegate the database work to put, because put can be used for both add and put, and the two operations are nearly identical. However, do not supply the input channel, so that its message is suppressed, so that add can send its own message as a substitute. Rethrow any put errors as add errors.

### TODOs
* if I plan to have validation also occur in `entry_sanitize`, then I think what should happen here is that I pass a `validate` flag (boolean, set to false) along to `entry_sanitize` to avoid revalidation because it could end up being a heavier operation, basically I am undecided about where validation should occur, and if I end up doing validation in multiple places I am concerned about redundant validation
* is it correct to have `rdr_create_entry` be concerned with state initialization of the entry object, or should it be a responsibility of something earlier in the pipeline? I revised `update_entry` so that it does no property modification, because I don't like the idea of implicit modification, and was trying to be more transparent. That required all callers to set dateUpdated and increased inconvenience, but it was overall good. Should I apply the same idea here?
* I plan to add validate to `update_entry`. I think in this case I need to pass along a parameter that avoids duplicate validation. Here is where I would do something like `validate = false` and call `update_entry` with this false flag.
* I wonder if I should decouple create entirely from relying on `update_entry`?
