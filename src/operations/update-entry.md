The `update_entry` function creates or overwrites an entry in the database. Returns the result of the internal put call, which is the new id of the entry when adding the entry to the database, because the database uses an auto-incremented key for new entries.

### Params

* conn {IDBDatabase} required, the handle to the database where the entry is stored
* channel {BroadcastChannel} optional, if specified then this sends messages to the channel about updating the entry
* entry {object} required, the entry to update, this cannot be a function object

### TODOs

* Look at the notes in create-entry about validation, I think maybe I want to add a validate flag here
* Eventually remove all interaction with the rdr-create-conn.js module, that should happen once I move all the functionality out of it
* Should be waiting for transaction to complete before resolving. A successful request is not the same thing as a successful transaction. Relying on the request's success is only a weak guarantee of consistency. As it is currently implemented this is kind of difficult because I need to get the new id from the request. As an aside, furthermore, I probably need to review all operations for the same anti-pattern and fix it. All the operations should guarantee the state change so as to avoid potential inconsistency. For the moment I am not doing this because it could amount of a functionality change, and in the current commit I am just focusing on the transition away from rdr-create-conn.js.
