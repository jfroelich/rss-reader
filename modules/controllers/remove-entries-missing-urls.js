// See license.md

'use strict';

async function remove_entries_missing_urls(log) {
  const db = new FeedDb();
  db.log = log;
  const chan = new BroadcastChannel('db');

  const entryStore = new EntryStore();

  try {
    await db.connect();
    entryStore.conn = db.conn;

    const entries = await entyStore.getAll();
    log.debug('Loaded %d entries', entries.length);
    const orphans = entries.filter((e) => !e.urls || !e.urls.length);
    log.debug('Found %d entries missing urls', orphans.length);
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
