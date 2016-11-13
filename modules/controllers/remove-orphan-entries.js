// See license.md

'use strict';

async function remove_orphan_entries(log) {

  const chan = new BroadcastChannel('db');
  const db = new FeedDb();
  db.log = log;

  try {
    await db.connect();
    const feedIds = await db.getFeedIds();
    const entries = await db.getEntries();
    log.debug('Loaded %d entries', entries.length);
    const orphans = entries.filter((e) => !e.feed || !feedIds.includes(e.feed));
    log.debug('Found %d orphaned entries', orphans.length);

    // TODO: in order not to have a leaky abstraction, I need a db.removeEntries
    // function that accepts a set of entry ids and a channel, then it can
    // use its own single transaction
    const tx = db.conn.transaction('entry', 'readwrite');
    const proms = orphans.map((e) => db.removeEntry(tx, e.id, chan));
    await Promise.all(proms);
    log.debug('Deleted %d entries', orphans.length);
  } catch(error) {
    log.warn(error);
  } finally {
    chan.close();
    db.close();
  }
}
