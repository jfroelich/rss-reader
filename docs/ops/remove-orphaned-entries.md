# remove-orphaned-entries
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
