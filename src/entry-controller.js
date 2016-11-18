// See license.md

'use strict'

class EntryController {

  constructor(entryStore) {
    this.entryStore = entryStore;
  }

  async markRead(id) {
    console.debug('Marking entry %s as read', id);

    if(!Number.isInteger(id) || id < 1)
      throw new TypeError(`Invalid entry id ${id}`);

    const entry = await this.entryStore.findById(id);
    if(!entry)
      throw new Error(`No entry found with id ${id}`);
    if(entry.readState === Entry.READ)
      throw new Error(`Already read entry with id ${id}`);
    entry.readState = Entry.READ;
    entry.dateRead = new Date();
    entry.dateUpdated = new Date();
    await this.entryStore.put(entry);
    await Badge.updateUnreadCount(this.entryStore.conn);
  }

  async removeEntriesMissingURLs() {
    console.debug('Removing missing urls');
    const chan = new BroadcastChannel('db');
    let numRemoved = 0;
    try {
      const entries = await this.entryStore.getAll();
      const invalids = entries.filter((e) => !e.urls || !e.urls.length);
      console.debug('Found %d entries missing urls', invalids.length);
      const ids = invalids.map((e) => e.id);
      await this.entryStore.removeAll(ids, chan);
      console.debug('Deleted %d entries', ids.length);
      numRemoved = ids.length;
    } finally {
      chan.close();
    }
    return numRemoved;
  }


  // TODO: this is not currently called from anywhere, but it contains
  // invalid code, this is a left as partially refactored and incomplete for
  // now
  // TODO: this needs FeedStore as well, so it really doesn't belong here.
  // It belongs in something like HealthController
  // Before I make that change I first need to get it working
  // I can't, it is just too wrong. feedStore needs to be an instance var
  // but it has nothing to do with the entry controller
  // This also feels like a monster object that will swallow all functionality
  async removeOrphanedEntries() {

    const chan = new BroadcastChannel('db');
    //const db = new ReaderDb();
    //const feedStore = new FeedStore();
    //const entryStore = new EntryStore();

    let conn;
    try {
      //conn = await db.connect();

      // TODO: This is sloppy, think of how to abstract
      //feedStore.conn = conn;
      //entryStore.conn = conn;
      const feedIds = await feedStore.getIds();
      const entries = await entryStore.getAll();
      const orphans = entries.filter((e) => !e.feed ||
        !feedIds.includes(e.feed));

      // TODO: in order not to have a leaky abstraction, I need an
      // entryStore.removeAll
      // function that accepts a set of entry ids and a channel, then it can
      // use its own single transaction

      const tx = conn.transaction('entry', 'readwrite');
      const proms = orphans.map((e) => entryStore.remove(tx, e.id, chan));
      await Promise.all(proms);
    } catch(error) {
      console.warn(error);
    } finally {
      chan.close();
      if(conn)
        conn.close();
    }
  }
}
