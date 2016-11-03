// See license.md

'use strict';

function unsubscribe(conn, feed_id, log = SilentConsole) {
  if(!Number.isInteger(feed_id) || feed_id < 1)
    throw new TypeError();
  return new Promise(async function unsub_impl(resolve, reject) {
    log.log('Unsubscribing from feed with id', feed_id);
    const chan = new BroadcastChannel('db');
    try {
      const tx = conn.transaction(['feed', 'entry'], 'readwrite');
      const eids = await db_get_entry_ids_for_feed(tx, feed_id, log);
      const promises = eids.map((eid) => db_delete_entry(tx, eid, chan, log));
      promises.push(db_delete_feed(tx, feed_id, log));
      await Promise.all(promises);
      log.debug('Deleted %d entries with feed id', eids.length, feed_id);
      resolve(eids.length);
    } catch(error) {
      reject(error);
    }
    chan.close();
  });
}
