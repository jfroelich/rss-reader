import {rdb_entry_create, ENTRY_STATE_ARCHIVED, ENTRY_STATE_READ, ENTRY_STATE_UNARCHIVED, rdb_open} from '/src/rdb.js';

// TODO: all modules in the feed-ops layer should use the feed-ops prefix

// TODO: drop auto-connect support

// Archives certain entries in the database
// @param conn {IDBDatabase} optional, storage database, if not specified then
// default database will be opened, used, and closed
// @param channel {BroadcastChannel} optional, post entry-archived messages
// @param entry_age_max {Number} how long before an entry is considered
// archivable (using date entry created), in milliseconds
export default async function archive_entries(conn, channel, entry_age_max) {
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

  const dconn = conn ? conn : await rdb_open();
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
    const key_path = [ENTRY_STATE_UNARCHIVED, ENTRY_STATE_READ];
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

  compacted_entry.archiveState = ENTRY_STATE_ARCHIVED;
  compacted_entry.dateArchived = new Date();
  compacted_entry.dateUpdated = new Date();
  return compacted_entry;
}

// Create a new entry and copy over certain fields
function entry_compact(entry) {
  const compacted_entry = rdb_entry_create();
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

// Calculates the approximate byte size of a value. This should only be used for
// informational purposes because it is hilariously inaccurate.
//
// Adapted from http://stackoverflow.com/questions/1248302
//
// Does not work with built-ins, which are objects that are a part of the basic
// Javascript library, like Document, or Element.
//
// This uses a stack internally to avoid recursion.
//
// @param input_value {Any} a value of any type
// @returns {Number} a positive integer representing the approximate byte size
// of the input value
function sizeof(input_value) {
  // visited_objects is a memoization of previously visited objects. In theory a
  // repeated object just means enough bytes to store a reference value, and
  // only the first object actually allocates additional memory.
  const visited_objects = [];
  const stack = [input_value];
  const has_own_prop = Object.prototype.hasOwnProperty;
  const object_to_string = Object.prototype.toString;

  let sz = 0;

  while (stack.length) {
    const value = stack.pop();

    // typeof null === 'object'
    if (value === null) {
      continue;
    }

    switch (typeof value) {
      case 'undefined':
        break;
      case 'boolean':
        sz += 4;
        break;
      case 'string':
        sz += value.length * 2;
        break;
      case 'number':
        sz += 8;
        break;
      case 'function':
        // Treat as some kind of function identifier
        sz += 8;
        break;
      case 'object':
        if (visited_objects.indexOf(value) === -1) {
          visited_objects.push(value);

          if (ArrayBuffer.isView(value)) {
            sz += value.length;
          } else if (Array.isArray(value)) {
            stack.push(...value);
          } else {
            const to_string_output = object_to_string.call(value);
            if (to_string_output === '[object Date]') {
              sz += 8;  // guess
            } else if (to_string_output === '[object URL]') {
              sz += 2 * value.href.length;  // guess
            } else {
              for (let prop_name in value) {
                if (has_own_prop.call(value, prop_name)) {
                  // Add size of the property name string itself
                  sz += prop_name.length * 2;
                  stack.push(value[prop_name]);
                }
              }
            }
          }
        }
        break;
      default:
        break;  // ignore
    }
  }

  return sz;
}
