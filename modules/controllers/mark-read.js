// See license.md

'use strict'

async function db_mark_entry_read(store, id, log = SilentConsole) {
  if(!Number.isInteger(id) || id < 1)
    throw new TypeError(`Invalid entry id ${id}`);
  log.debug('Marking entry %s as read', id);
  const tx = store.conn.transaction('entry', 'readwrite');
  const entry = await store.findEntryById(tx, id);
  if(!entry)
    throw new Error(`No entry found with id ${id}`);
  if(entry.readState === Entry.READ)
    throw new Error(`Already read entry with id ${id}`);
  entry.readState = Entry.READ;
  entry.dateRead = new Date();
  await store.putEntry(tx, entry);
  await badge_update_text(store, log);
}
