import {entryHasURL, open as openReaderDb} from "/src/rdb.js";

// Scans the entry store for entry objects that are missing urls and removes
// them
export default async function removeLostEntries(conn, channel, console) {
  console = console || NULL_CONSOLE;
  console.log('Removing lost entries...');

  const dconn = conn ? conn : await openReaderDb();
  const entryIds = await removeLostEntriesPromise(dconn, console);
  if(!conn) {
    console.debug('Closing dynamic connection to database', dconn.name);
    dconn.close();
  }

  console.debug('Found %d lost entries', entryIds.length);

  // Now that the transaction has fully committed, notify observers. channel is
  // optional so check if present. Assume if present that it is correct type

  // If removeLostEntries was called in non-blocking fashion, channel may have
  // closed before promise settled above, which would cause postMessage to
  // throw, but there is no way to check if channel closed, and we are forked
  // so throwing sends an error to a place where no one is listening, so just
  // trap and log the error
  if(channel) {
    const message = {type: 'entry-deleted', id: undefined, reason: 'lost'};
    for(const id of entryIds) {
      message.id = id;
      channelPostMessageNoExcept(channel, message, console);
    }
  }
}

function channelPostMessageNoExcept(channel, message, console) {
  try {
    channel.postMessage(message);
    console.debug('Posted message to channel', channel.name, message);
  } catch(error) {
    console.warn(error);
  }
}


// Returns a promise that resolves to an array of entry ids that were deleted
function removeLostEntriesPromise(conn, console) {
  return new Promise((resolve, reject) => {
    const entryIds = [];

    // Use a single transaction for read and deletes to ensure consistency.

    const tx = conn.transaction('entry', 'readwrite');
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve(entryIds);
    const store = tx.objectStore('entry');

    // Although getAll would be faster, it does not scale. Instead, walk the
    // store one entry at a time.
    const request = store.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if(!cursor) {
        return;
      }

      const entry = cursor.value;

      if(!entryHasURL(entry)) {
        console.debug('Deleting lost entry', entry.id);

        // Calling delete appends a request to the transaction. Remember that
        // nothing has committed until the transaction completes. Therefore it
        // would be inappropriate to do channel notifications here because it
        // would be immature.
        // TODO: what if I post a message with the property 'speculative', or
        // post a message of a different type, like
        // 'entry-speculatively-deleted'? Worth it? Pedantic? This comment
        // should be moved to a github issue

        cursor.delete();

        // Track which entries have been deleted
        entryIds.push(entry.id);
      }

      cursor.continue();
    };
  });
}

function noop() {}

const NULL_CONSOLE = {
  log: noop,
  warn: noop,
  debug: noop
};
