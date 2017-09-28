// Unsubscribes from a feed
// @param conn {IDBDatabase} an open database connection
// @param feed_id {Number} id of feed to unscubscribe
// @param verbose {Boolean} optional, whether to print logging info
async function unsubscribe(conn, feed_id, verbose) {
  'use strict';
  if(!Number.isInteger(feed_id))
    throw new TypeError('feed id is not an integer');
  if(feed_id < 1)
    throw new TypeError('feed id is less than 1');
  if(verbose)
    console.log('Unsubscribing from feed with id', feed_id);

  const entry_ids = await reader_db.find_entry_ids_for_feed(conn, feed_id);
  await reader_db.remove_feed_and_entries(conn, feed_id, entry_ids);

  // Broadcast remove messages
  const channel = new BroadcastChannel('db');
  channel.postMessage({'type': 'feedDeleted', 'id': feed_id});
  // To avoid large message size, broadcast individual messages.
  for(const entry_id of entry_ids)
    channel.postMessage({'type': 'entryDeleted', 'id': entry_id});
  channel.close();

  if(verbose)
    console.log('Unsubscribed from feed with id', feed_id,
      ', deleted %d entries', entry_ids.length);
  ext_update_badge(verbose);
  return entry_ids.length;
}
