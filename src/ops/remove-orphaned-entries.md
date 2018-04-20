Scans the database for entries not linked to a feed and deletes them

### Params
* **conn** {IDBDatabase} open database connection
* **channel** {BroadcastChannel} optional, broadcast channel

### TODOS
* this potentially affects unread count and therefore should be interacting with `badge.update`
* add console parameter and NULL_CONSOLE impl
