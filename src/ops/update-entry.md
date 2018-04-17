The `update_entry` function creates or overwrites an entry in the database. Returns the result of the internal put call, which is the new id of the entry when adding the entry to the database, because the database uses an auto-incremented key for new entries.

### Context properties
* conn {IDBDatabase} required, the handle to the database where the entry is stored
* channel {BroadcastChannel} required, this sends messages to the channel about updating the entry
* console {Object} required, logging destination

### Params
* entry {object} required, the entry to update, this cannot be a function object
* validate {Boolean} whether to validate the input object

### TODOs
* Should be waiting for transaction to complete before resolving. A successful request is not the same thing as a successful transaction. Relying on the request's success is only a weak guarantee of consistency. As it is currently implemented this is kind of difficult because I need to get the new id from the request. As an aside, furthermore, I probably need to review all operations for the same anti-pattern and fix it. All the operations should guarantee the state change so as to avoid potential inconsistency. For the moment I am not doing this because it could amount of a functionality change, and in the current commit I am just focusing on the transition away from create-conn.js.
* validation error should at least be a rejection, not an immediate exception, because input data is routinely bad, not assumed well-formed, and not really an error.
* validation shouldn't throw an exception. data is routinely bad. bad data is not a program error.
