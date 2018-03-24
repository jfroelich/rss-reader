// Marks a feed as active. This loads the feed, changes its properties, and
// then saves it again using a single transaction. Once the transaction
// resolves, a message is sent to the channel. Caller should take care to not
// close the channel before this settles. If this rejects with an error due to a
// closed channel, the database transaction has still committed.
// @param conn {IDBDatabase} an open database connection, required
// @param channel {BroadcastChannel} optional, the channel to receive a message
// about the state change
// @param feed_id {Number} the id of the feed to modify
// @throws {Error} database error, invalid input error, channel error, note
// these are technically rejections unless this is awaited
// @return {Promise} a promise that resolves
