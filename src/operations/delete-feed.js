import {feed_is_valid_id} from '/src/objects/feed.js';
import {rdr_badge_refresh} from '/src/operations/rdr-badge-refresh.js';

// TODO: setup null_console pattern
// TODO: setup null_channel pattern

export function delete_feed(conn, channel, feed_id, reason_text) {
  if (!feed_is_valid_id(feed_id)) {
    throw new TypeError('Invalid feed id ' + feed_id);
  }

  return new Promise(executor.bind(null, conn, channel, feed_id, reason_text));
}

function executor(conn, channel, feed_id, reason_text, resolve, reject) {
  let entry_ids;
  const txn = conn.transaction(['feed', 'entry'], 'readwrite');
  txn.oncomplete = txn_oncomplete.bind(
      conn, txn, channel, feed_id, reason_text, entry_ids, resolve);
  txn.onerror = _ => reject(txn.error);

  const feed_store = txn.objectStore('feed');
  console.debug('Deleting feed with id', feed_id);
  feed_store.delete(feed_id);

  // Find and delete all entries belonging to the feed
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

// TODO: get conn from event rather than from parameter

function txn_oncomplete(
    conn, channel, feed_id, reason_text, entry_ids, callback, event) {
  // Temp: looking for the conn property
  console.dir(event);

  if (channel) {
    channel.postMessage(
        {type: 'feed-deleted', id: feed_id, reason: reason_text});
    for (const id of entry_ids) {
      channel.postMessage({type: 'entry-deleted', id: id, reason: reason_text});
    }
  }

  // Deleting (unsubscribing) from a feed may have deleted one or more entries
  // that were in the unread state and were contributing to the total unread
  // count, so the badge text is out of date.
  // Because this is unawaited it will still be pending at time of resolution
  // of delete_feed
  rdr_badge_refresh(conn, void console).catch(console.error);

  callback(entry_ids);
}
