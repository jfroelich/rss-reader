// See license.md

'use strict'

async function jrEntryMarkRead(entryStore, id) {
  if(!Number.isInteger(id) || id < 1)
    throw new TypeError(`Invalid entry id ${id}`);
  const entry = await entryStore.findById(id);
  if(!entry)
    throw new Error(`No entry found with id ${id}`);
  if(entry.readState === ENTRY_READ_STATE)
    throw new Error(`Already read entry with id ${id}`);
  entry.readState = ENTRY_READ_STATE;
  entry.dateRead = new Date();
  entry.dateUpdated = new Date();
  await entryStore.put(entry);
  await jrExtensionUpdateBadge(this.entryStore);
}


async function jrEntryRemoveMissingURLs(entryStore) {
  const chan = new BroadcastChannel('db');
  let numRemoved = 0;
  try {
    const entries = await entryStore.getAll();
    const invalidEntries = entries.filter((e) => !e.urls || !e.urls.length);
    const entryIds = invalidEntries.map((e) => e.id);
    await entryStore.removeAll(entryIds, chan);
    numRemoved = ids.length;
  } finally {
    chan.close();
  }
  return numRemoved;
}

async function jrEntryRemoveOrphanedEntries(conn, feedStore, entryStore) {
  const chan = new BroadcastChannel('db');
  try {
    const feedIds = await feedStore.getIds();
    const entries = await entryStore.getAll();
    const orphans = entries.filter((e) => !e.feed ||
      !feedIds.includes(e.feed));
    const tx = conn.transaction('entry', 'readwrite');
    const proms = orphans.map((e) => entryStore.remove(tx, e.id, chan));
    await Promise.all(proms);
  } catch(error) {
    console.warn(error);
  } finally {
    chan.close();
  }
}

async function removeMissingEntriesOnAlarm(alarm) {
  if(alarm.name === 'remove-entries-missing-urls') {
    console.debug('Received remote-entries-missing-urls alarm wakeup');
    const readerDb = new ReaderDb();
    const entryStore = new EntryStore();
    const entryController = new EntryController(entryStore);
    let conn;
    try {
      conn = await readerDb.dbConnect();
      entryStore.conn = conn;
      entryController.jrEntryRemoveMissingURLs();
    } catch(error) {
      console.warn(error);
    } finally {
      if(conn)
        conn.close();
    }
  }
}
