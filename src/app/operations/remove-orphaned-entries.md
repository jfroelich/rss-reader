
// Scans the database for entries not linked to a feed and deletes them
// conn {IDBDatabase} is optional open database connection
// channel {BroadcastChannel} is optional broadcast channel

### TODOS

* drop auto-connect support. The proper way, if at all, is to go through a layer similar to ral.js
* this potentially affects unread count and therefore should be interacting with badge_update_text
* add console parameter and NULL_CONSOLE impl
