# idb
Provides some basic utilities for indexedDB. The principal function is `idb_open`. This function opens a connection to an indexedDB database. The important additions to the normal functionality of indexedDB.open are that you can optionally specify a timeout after which to consider the connection a failure, and that a blocked connection is treated as an error (and the connection is automatically closed should it ever open later).

### Note about upgrade behavior
An upgrade can still happen in the event of a rejection. I am not trying to prevent that as an implicit side effect, although it is possible to abort the versionchange transaction from within the upgrade listener. If I wanted to do that I would wrap the call to the listener here with a function that first checks if blocked/timed_out and if so aborts the transaction and closes, otherwise forwards to the listener.
