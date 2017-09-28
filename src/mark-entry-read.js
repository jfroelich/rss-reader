async function mark_entry_read(conn, entry_id, verbose) {
  'use strict';
  if(!Number.isInteger(entry_id))
    throw new TypeError('entry_id not an integer');
  if(entry_id < 1)
    throw new TypeError('entry_id not positive');
  const entry = await reader_db.find_entry_by_id(conn, entry_id);
  if(!entry)
    throw new Error(`No entry found with id ${entry_id}`);
  else if(entry.readState === ENTRY_STATE_READ)
    throw new Error(`Already read entry with id ${entry_id}`);

  entry.readState = ENTRY_STATE_READ;
  const current_date = new Date();
  entry.dateRead = current_date;
  entry.dateUpdated = current_date;
  await reader_db.put_entry(conn, entry);
  if(verbose)
    console.log('Updated database with read entry with id', entry_id);
  ext_update_badge(verbose);
}
