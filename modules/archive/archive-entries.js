// See license.md

'use strict';

async function archive_entries(store,
  max_age = config.archive_default_entry_max_age, log = SilentConsole) {

  if(!Number.isInteger(max_age) || max_age < 0)
    throw new TypeError();

  log.log('Archiving entries older than %dms', max_age);

  // Load all unarchived read entries
  const tx = store.conn.transaction('entry', 'readwrite');
  const entries = await store.getUnarchivedReadEntries(tx);
  log.debug('Loaded %d entries', entries.length);

  // Get archivable entries
  const current_date = new Date();
  const archivable_entries = entries.filter((entry) =>
    current_date - entry.dateCreated > max_age);
  log.debug('Archiving %d entries', archivable_entries.length);

  // Compact the archivable entries
  // TODO: reimplement compact as a simple property whitelist filter?
  // Would still need to set the Entry.ARCHIVED flag
  const compacted_entries = archivable_entries.map(function compact(entry) {
    const compacted = {
      'archiveState': Entry.ARCHIVED,
      'dateArchived': current_date,
      'dateCreated': entry.dateCreated,
      'dateRead': entry.dateRead,
      'feed': entry.feed,
      'id': entry.id,
      'readState': entry.readState,
      'urls': entry.urls
    };

    if(log === console)
      log.debug(sizeof(entry), 'bytes compacted to', sizeof(compacted));

    return compacted;
  });

  // Notify others of the pending entry updates
  const chan = new BroadcastChannel('db');
  compacted_entries.forEach((entry) =>
    chan.postMessage({'type': 'archive_entry', 'id': entry.id}));
  chan.close();

  // Replace archivable entries with compacted entries in the database
  // If there is any failure, the entire transaction will abort
  const proms = compacted_entries.map((entry) => store.putEntry(tx, entry));
  await Promise.all(proms);

  log.log('Archive entries completed (scanned %d, compacted %d)',
    entries.length, archivable_entries.length);
  return archivable_entries.length;
}
