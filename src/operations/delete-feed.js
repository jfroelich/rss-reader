import {feed_is_valid_id} from '/src/objects/feed.js';
import {rdr_badge_refresh} from '/src/operations/rdr-badge-refresh.js';

const null_console = {
  warn: noop,
  debug: noop,
  log: noop,
  dir: noop
};

const null_channel = {
  name: 'null-channel',
  postMessage: noop,
  close: noop
};

export function delete_feed(
    conn, channel = null_channel, console = null_console, feed_id,
    reason_text) {
  if (!feed_is_valid_id(feed_id)) {
    throw new TypeError('Invalid feed id ' + feed_id);
  }

  return new Promise(
      executor.bind(null, conn, channel, console, feed_id, reason_text));
}

function executor(
    conn, channel, console, feed_id, reason_text, resolve, reject) {
  let entry_ids;
  const txn = conn.transaction(['feed', 'entry'], 'readwrite');
  txn.oncomplete = txn_oncomplete.bind(
      conn, txn, channel, console, feed_id, reason_text, entry_ids, resolve);
  txn.onerror = _ => reject(txn.error);

  const feed_store = txn.objectStore('feed');

  // Delete the feed
  console.debug('Deleting feed with id', feed_id);
  feed_store.delete(feed_id);

  // Delete all entries belonging to the feed
  const entry_store = txn.objectStore('entry');
  const feed_index = entry_store.index('feed');
  const request = feed_index.getAllKeys(feed_id);
  request.onsuccess = function(event) {
    entry_ids = request.result;
    for (const id of entry_ids) {
      console.debug('Deleting entry', id);
      entry_store.delete(id);
    }
  };
}

function txn_oncomplete(
    conn, channel, console, feed_id, reason_text, entry_ids, callback, event) {
  channel.postMessage({type: 'feed-deleted', id: feed_id, reason: reason_text});
  for (const id of entry_ids) {
    channel.postMessage({type: 'entry-deleted', id: id, reason: reason_text});
  }

  rdr_badge_refresh(conn, console).catch(console.error);

  callback(entry_ids);
}

function noop() {}
