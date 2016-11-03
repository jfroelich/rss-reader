// See license.md

'use strict';

function archive_entries(conn, max_age = config.archive_default_entry_max_age,
  log = SilentConsole) {
  if(!Number.isInteger(max_age) || max_age < 0)
    throw new TypeError();
  return new Promise(async function archive_impl(resolve, reject) {
    log.log('Archiving entries older than %dms', max_age);

    // Load all unarchived read entries
    const tx = conn.transaction('entry', 'readwrite');
    let entries;
    try {
      entries = await db_get_unarchived_read_entries(tx, log);
    } catch(error) {
      reject(error);
      return;
    }
    log.debug('Loaded %d entries', entries.length);

    // Get archivable entries
    const current_date = new Date();
    const archivable_entries = entries.filter((entry) =>
      current_date - entry.dateCreated > max_age);
    log.debug('Archiving %d entries', archivable_entries.length);

    // Compact the archivable entries
    // TODO: reimplement compact as a simple property whitelist filter?
    // Would still need to set the ENTRY_ARCHIVED flag
    const compacted_entries = archivable_entries.map(function compact(entry) {
      const compacted = {
        'archiveState': ENTRY_ARCHIVED,
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
    // TODO: does the error occur when calling the promise, or when awaiting?
    // If only when awaiting, then the map call does not need to be in the
    // try/catch. My instinct is reject does not raise immediate error, and
    // that await is what checks for any error and throws it
    try {
      const proms = compacted_entries.map((entry) =>
        db_put_entry(tx, entry, log));

      await Promise.all(proms);
    } catch(error) {
      reject(error);
      return;
    }

    log.log('Archive entries completed (scanned %d, compacted %d)',
      entries.length, archivable_entries.length);
    resolve(archivable_entries.length);
  });
}
