// See license.md

'use strict';

async function remove_orphan_entries(log) {
  let store, chan;
  try {
    chan = new BroadcastChannel('db');
    store = await ReaderStorage.connect(log);
    const feedIds = await store.getFeedIds();
    const entries = await store.getEntries();
    log.debug('Loaded %d entries', entries.length);
    const orphans = entries.filter((e) => !e.feed || !feedIds.includes(e.feed));
    log.debug('Found %d orphaned entries', orphans.length);
    const tx = store.conn.transaction('entry', 'readwrite');
    const proms = orphans.map((e) => store.removeEntry(tx, e.id, chan));
    await Promise.all(proms);
    log.debug('Deleted %d entries', orphans.length);
  } catch(error) {
    log.warn(error);
  } finally {
    if(chan)
      chan.close();
    if(store)
      store.disconnect();
  }
}
