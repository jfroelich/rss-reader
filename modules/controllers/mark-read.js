// See license.md

'use strict'

async function db_mark_entry_read(db, id, log = SilentConsole) {
  if(!Number.isInteger(id) || id < 1)
    throw new TypeError(`Invalid entry id ${id}`);
  log.debug('Marking entry %s as read', id);

  const entryStore = new EntryStore();
  entryStore.conn = db.conn;

  // TODO: I dont think the find request needs to shared tx with the other
  // request

  const tx = db.conn.transaction('entry', 'readwrite');
  const entry = await entryStore.findById(tx, id);
  if(!entry)
    throw new Error(`No entry found with id ${id}`);
  if(entry.readState === Entry.READ)
    throw new Error(`Already read entry with id ${id}`);
  entry.readState = Entry.READ;
  entry.dateRead = new Date();
  await entryStore.put(tx, entry);
  await Badge.updateUnreadCount(db);
}
