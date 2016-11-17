// See license.md

'use strict';

async function remove_orphan_entries(log) {

  const chan = new BroadcastChannel('db');
  const db = new FeedDb();
  db.log = log;


  const feedStore = new FeedStore();
  const entryStore = new EntryStore();

  // TODO: in order not to have a leaky abstraction, I need a entryStore.remove
  // function that accepts a set of entry ids and a channel, then it can
  // use its own single transaction

  try {
    await db.connect();

    // This is sloppy, think of how to abstract, maybe db is constructor
    // parameter to these?
    feedStore.conn = db.conn;
    entryStore.conn = db.conn;

    const feedIds = await feedStore.getIds();
    const entries = await entryStore.getAll();
    log.debug('Loaded %d entries', entries.length);
    const orphans = entries.filter((e) => !e.feed || !feedIds.includes(e.feed));
    log.debug('Found %d orphaned entries', orphans.length);
    const tx = db.conn.transaction('entry', 'readwrite');
    const proms = orphans.map((e) => entryStore.remove(tx, e.id, chan));
    await Promise.all(proms);
    log.debug('Deleted %d entries', orphans.length);
  } catch(error) {
    log.warn(error);
  } finally {
    chan.close();
    db.close();
  }
}
