# remove-lost-entries
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
