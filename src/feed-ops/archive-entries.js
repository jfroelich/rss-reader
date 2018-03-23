import * as rdb from '/src/rdb/rdb.js';
import {sizeof} from '/src/sizeof/sizeof.js';

// TODO:
// * revert to object
// * remove auto connect

export async function archive_entries(conn, channel, entry_age_max) {
  console.log('Archiving entries...');

  if (typeof entry_age_max === 'undefined') {
    const TWO_DAYS_MS = 1000 * 60 * 60 * 24 * 2;
    entry_age_max = TWO_DAYS_MS;
  }

  if (typeof entry_age_max !== 'undefined') {
    if (!Number.isInteger(entry_age_max) || entry_age_max < 1) {
      throw new TypeError('Invalid entry_age_max argument ' + entry_age_max);
    }
  }

  const dconn = conn ? conn : await rdb.open();
  const entry_ids = await archive_entries_promise(dconn, entry_age_max);
  if (!conn) {
    dconn.close();
  }

  if (channel) {
    for (const id of entry_ids) {
      channel.postMessage({type: 'entry-archived', id: id});
    }
  }

  console.debug('Archived %d entries', entry_ids.length);
}

function archive_entries_promise(conn, entry_age_max) {
  return new Promise((resolve, reject) => {
    const entry_ids = [];
    const tx = conn.transaction('entry', 'readwrite');
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve(entry_ids);
    const store = tx.objectStore('entry');
    const index = store.index('archiveState-readState');
    const key_path = [rdb.ENTRY_STATE_UNARCHIVED, rdb.ENTRY_STATE_READ];
    const request = index.openCursor(key_path);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        return;
      }

      const entry = cursor.value;
      if (entry.dateCreated) {
        const current_date = new Date();
        const age = current_date - entry.dateCreated;
        if (age > entry_age_max) {
          const archived_entry = entry_archive(entry);
          store.put(archived_entry);
          entry_ids.push(archived_entry.id);
        }
      }

      cursor.continue();
    };
  });
}

function entry_archive(entry) {
  const before_sz = sizeof(entry);
  const compacted_entry = entry_compact(entry);
  const after_sz = sizeof(compacted_entry);
  console.debug(
      'Changing entry %d size from ~%d to ~%d', entry.id, before_sz, after_sz);

  compacted_entry.archiveState = rdb.ENTRY_STATE_ARCHIVED;
  compacted_entry.dateArchived = new Date();
  compacted_entry.dateUpdated = new Date();
  return compacted_entry;
}

// Create a new entry and copy over certain fields
function entry_compact(entry) {
  const compacted_entry = rdb.entry_create();
  compacted_entry.dateCreated = entry.dateCreated;

  if (entry.dateRead) {
    compacted_entry.dateRead = entry.dateRead;
  }

  compacted_entry.feed = entry.feed;
  compacted_entry.id = entry.id;
  compacted_entry.readState = entry.readState;
  compacted_entry.urls = entry.urls;
  return compacted_entry;
}
