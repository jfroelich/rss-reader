import assert from '/src/assert.js';
import * as entry_utils from './entry-utils.js';
import * as feed_utils from './feed-utils.js';

// Remove a feed and its associated data from the database using a single
// transaction.
export async function delete_feed(session, feed_id, reason) {
  assert(feed_utils.is_valid_feed_id(feed_id));

  const promise = new Promise(executor.bind(null, session.conn, feed_id));
  const entry_ids = await promise;

  if (session.channel) {
    const feed_message = {type: 'feed-deleted', id: feed_id, reason: undefined};

    // Avoid setting reason unless it is a string so as to not potentially
    // output garbage
    if (typeof reason === 'string') {
      feed_message.reason = reason;
    }

    session.channel.postMessage(feed_message);

    const entry_message = {
      type: 'entry-deleted',
      id: entry_utils.INVALID_ENTRY_ID,
      reason: undefined,
      feed_id: feed_id
    };

    if (typeof reason === 'string') {
      entry_message.reason = reason;
    }

    for (const id of entry_ids) {
      entry_message.id = id;
      session.channel.postMessage(entry_message);
    }
  }
}

function executor(conn, feed_id, resolve, reject) {
  const entry_ids = [];
  const txn = conn.transaction(['feed', 'entry'], 'readwrite');
  txn.onerror = event => reject(event.target.error);
  txn.oncomplete = _ => resolve(entry_ids);

  const feed_store = txn.objectStore('feed');
  feed_store.delete(feed_id);

  // Delete all associated entries. Lookup associated entries using the feed id
  // index on the entry store, then issue a delete request for each one.
  // We use getAllKeys to avoid loading full entry data. Instead we load only
  // the entry id property of the index. Also, this loads the full set of keys
  // in one roundtrip.

  const entry_store = txn.objectStore('entry');
  const feed_index = entry_store.index('feed');
  const request = feed_index.getAllKeys(feed_id);
  request.onsucess =
      request_entry_keys_onsuccess.bind(request, entry_ids, entry_store);
}

function request_entry_keys_onsuccess(entry_ids, entry_store, event) {
  const keys = event.target.result;
  for (const id of keys) {
    entry_ids.push(id);
    entry_store.delete(id);
  }
}
