// See license.md

'use strict';

async function archive_entries(conn,
  max_age = config.archive_default_entry_max_age, log = SilentConsole) {
  if(!Number.isInteger(max_age) || max_age < 0)
    throw new TypeError();
  log.log('Archiving entries older than %d ms', max_age);

  const entryStore = new EntryStore(conn);
  const entries = await entryStore.getUnarchivedRead();
  log.debug('Loaded %d entries', entries.length);
  const current_date = new Date();
  const archivable_entries = entries.filter((entry) =>
    current_date - entry.dateCreated > max_age);
  log.debug('Archiving %d entries', archivable_entries.length);

  const retained = {
    'dateCreated': undefined,
    'dateRead': undefined,
    'feed': undefined,
    'id': undefined,
    'readState': undefined,
    'urls': undefined
  };

  function should_retain(obj, prop) {
    return prop in retained;
  }

  const compacted_entries = archivable_entries.map((entry) => {
    const compacted = filter_object(entry, should_retain);
    compacted.archiveState = Entry.ARCHIVED;
    compacted.dateArchived = current_date;
    return compacted;
  });

  if(log === console) {
    for(let i = 0, len = archivable_entries.length; i < len; i++) {
      log.debug(sizeof(archivable_entries[i]), 'compacted to',
        sizeof(compacted_entries[i]));
    }
  }

  const put_resolutions = await entryStore.putAll(compacted_entries);
  const archived_ids = compacted_entries.map((entry) => entry.id);
  const chan = new BroadcastChannel('db');
  chan.postMessage({'type': 'archived_entries', 'entry_ids': archived_ids})
  chan.close();
  log.log('Archive entries completed (scanned %d, compacted %d)',
    entries.length, archivable_entries.length);
  return archivable_entries.length;
}
