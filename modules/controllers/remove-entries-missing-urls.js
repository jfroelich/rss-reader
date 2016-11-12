// See license.md

'use strict';

async function remove_entries_missing_urls(log) {
  let store, chan;
  try {
    chan = new BroadcastChannel('db');
    store = await ReaderStorage.connect(log);
    const entries = await store.getEntries();
    log.debug('Loaded %d entries', entries.length);
    const orphans = entries.filter((e) => !e.urls || !e.urls.length);
    log.debug('Found %d entries missing urls', orphans.length);
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
