import {entryHasURL, open as openReaderDb} from '/src/rdb.js';

// TODO: move this comment to github issue
// TODO: consider speculative messaging, where I post a message to a channel of
// a different type before the database operation settled. one of the benefits
// is that I avoid issues with channel closing early when remove is called
// unawaited and channel is closed before settling.

// Scans the entry store for entry objects that are missing urls and removes
// them
// @param conn {IDBDatabase}
// @param channel {BroadcastChannel}
// @param console {Object}
export default async function removeLostEntries(conn, channel, console) {
  console = console || NULL_CONSOLE;
  console.log('Removing lost entries...');

  const dconn = conn ? conn : await openReaderDb();
  const entryIds = await removeLostEntriesPromise(dconn, console);
  if (!conn) {
    console.debug('Closing dynamic connection to database', dconn.name);
    dconn.close();
  }

  console.debug('Found %d lost entries', entryIds.length);
  if (channel) {
    const message = {type: 'entry-deleted', id: undefined, reason: 'lost'};
    for (const id of entryIds) {
      message.id = id;

      // If removeLostEntries is not awaited, channel may close before the
      // promise settled above, which would cause postMessage to throw, but
      // there is no way to check if channel closed, and we are forked so
      // throwing sends an error to a place where no one is listening
      channelPostMessageNoExcept(channel, message, console);
    }
  }
}

function channelPostMessageNoExcept(channel, message, console) {
  try {
    channel.postMessage(message);
    console.debug('Posted message to channel', channel.name, message);
  } catch (error) {
    console.warn(error);
  }
}


// Returns a promise that resolves to an array of entry ids that were deleted
// This uses a single transaction to ensure consistency.
function removeLostEntriesPromise(conn, console) {
  return new Promise((resolve, reject) => {
    const entryIds = [];
    const tx = conn.transaction('entry', 'readwrite');
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve(entryIds);
    const store = tx.objectStore('entry');

    // Although getAll would be faster, it does not scale
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        const entry = cursor.value;
        if (!entryHasURL(entry)) {
          console.debug('Deleting lost entry', entry.id);
          cursor.delete();
          entryIds.push(entry.id);
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
