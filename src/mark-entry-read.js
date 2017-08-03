// See license.md
'use strict';

{ // Begin file block scope

async function mark_entry_read(conn, entry_id, verbose) {
  if(!Number.isInteger(entry_id) || entry_id < 1)
    throw new TypeError(`Invalid entry id ${entry_id}`);
  const entry = await db_find_entry_by_id(conn, entry_id);
  if(!entry)
    throw new Error(`No entry found with id ${entry_id}`);
  else if(entry.readState === ENTRY_STATE_READ)
    throw new Error(`Already read entry with id ${entry_id}`);

  entry.readState = ENTRY_STATE_READ;
  const current_date = new Date();
  entry.dateRead = current_date;
  entry.dateUpdated = current_date;
  await db_put_entry(conn, entry);
  if(verbose)
    console.log('Updated database with read entry with id', entry_id);

  // Non awaited
  ext_update_badge(verbose).catch(console.warn);
}

function db_find_entry_by_id(conn, id) {
  function resolver(resolve, reject) {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }
  return new Promise(resolver);
}

function db_put_entry(conn, entry) {
  function resolver(resolve, reject) {
    const tx = conn.transaction('entry', 'readwrite');
    const request = tx.objectStore('entry').put(entry);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }
  return new Promise(resolver);
}

this.mark_entry_read = mark_entry_read;

} // End file block scope
