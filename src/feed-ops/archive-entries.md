// Archives certain entries in the database
// @param conn {IDBDatabase} optional, storage database, if not specified then
// default database will be opened, used, and closed
// @param channel {BroadcastChannel} optional, post entry-archived messages
// @param entry_age_max {Number} how long before an entry is considered
// archivable (using date entry created), in milliseconds

TODOs

* all modules in the feed-ops layer should use the feed-ops prefix
* do not export default
* drop auto-connect support
* move sizeof back to its own module
