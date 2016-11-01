// See license.md

'use strict';

const archive_default_entry_max_age = 1 * 24 * 60 * 60 * 1000; // 1 day in ms

function archive_entries(conn, max_age = archive_default_entry_max_age,
  log = SilentConsole) {
  return new Promise(function archive_impl(resolve, reject) {
    if(typeof max_age !== 'undefined' &&
      (!Number.isInteger(max_age) || max_age < 0)) {
      reject(new TypeError());
      return;
    }

    log.log('Archiving entries older than %d ms', max_age);
    let num_modified = 0, num_scanned = 0;
    const current_date = new Date();
    const chan = new BroadcastChannel('db');
    log.debug('Opened broadcast channel', chan.name);

    const tx = conn.transaction('entry', 'readwrite');
    tx.onabort = function(event) {
      reject(event.target.error);
      log.debug('Closing broadcast channel', chan.name);
      chan.close();
    };

    tx.oncomplete = function(event) {
      log.log('Archive entries completed (scanned %d, compacted %d)',
        num_scanned, num_modified);
      resolve(num_modified);
      log.debug('Closing broadcast channel', chan.name);
      chan.close();
    };

    const store = tx.objectStore('entry');
    const index = store.index('archiveState-readState');
    const key_path = [ENTRY_UNARCHIVED, ENTRY_READ];
    const request = index.openCursor(key_path);
    request.onsuccess = function(event) {
      const cursor = event.target.result;
      if(!cursor)
        return;

      const entry = cursor.value;
      const age = current_date - entry.dateCreated;
      log.debug('Visiting', get_entry_url(entry));
      if(age > max_age) {
        num_modified++;

        const compacted = {};
        compacted.archiveState = ENTRY_ARCHIVED;
        compacted.dateArchived = current_date;
        compacted.dateCreated = entry.dateCreated;
        if(entry.dateRead)
          compacted.dateRead = entry.dateRead;
        compacted.feed = entry.feed;
        compacted.id = entry.id;
        compacted.readState = entry.readState;
        compacted.urls = entry.urls;

        if(log === console) {
          const before = sizeof(entry);
          const after = sizeof(compacted);
          log.debug('Compacted entry %s (age %s, before %s, after %s)',
            get_entry_url(entry), age, before, after);
        }

        // This is async. The promise may resolve before this resolves.
        // However, conn.close allows for pending requests to resolve.
        cursor.update(compacted);
        chan.postMessage({'type': 'archive_entry_request', 'id': entry.id});
      }
      num_scanned++;
      cursor.continue();
    };

    request.onerror = function(event) {
      // TODO: this aborts, right? double check
      // the issue is this might double reject
      // just going to not reject here for now and assume
      // tx.onabort is called
      log.debug(event.target.error);
    };
  });
}
