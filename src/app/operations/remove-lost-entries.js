import * as rdb from '/src/app/handles/rdb.js';
import {entry_has_url} from '/src/app/objects/entry.js';

export async function remove_lost_entries(conn, channel, console) {
  console = console || NULL_CONSOLE;

  const dconn = conn ? conn : await rdb.open();
  const entry_ids =
      await entry_store_remove_lost_entries_promise(dconn, console);
  if (!conn) {
    console.debug('Closing connection to database', dconn.name);
    dconn.close();
  }

  console.debug('Found %d lost entries', entry_ids.length);
  if (channel) {
    const message = {type: 'entry-deleted', id: undefined, reason: 'lost'};
    for (const id of entry_ids) {
      message.id = id;

      // If entry_store_remove_lost_entries is not awaited, channel may close
      // before the promise settled above, which would cause postMessage to
      // throw, but there is no way to check if channel closed, and we are
      // forked so throwing sends an error to a place where no one is listening
      channel_post_message_noexcept(channel, message, console);
    }
  }
}

function channel_post_message_noexcept(channel, message, console) {
  try {
    channel.postMessage(message);
  } catch (error) {
    console.warn(error);
  }
}

// Returns a promise that resolves to an array of entry ids that were deleted
// This uses a single transaction to ensure consistency.
function entry_store_remove_lost_entries_promise(conn, console) {
  return new Promise((resolve, reject) => {
    const entry_ids = [];
    const tx = conn.transaction('entry', 'readwrite');
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve(entry_ids);
    const store = tx.objectStore('entry');

    // Use openCursor instead of getAll for scalability
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        const entry = cursor.value;
        if (!entry_has_url(entry)) {
          console.debug('Deleting lost entry', entry.id);
          cursor.delete();
          entry_ids.push(entry.id);
        }

        cursor.continue();
      }
    };
  });
}

function noop() {}

// A partial stub for console that suppresses log messages
const NULL_CONSOLE = {
  log: noop,
  warn: noop,
  debug: noop
};
