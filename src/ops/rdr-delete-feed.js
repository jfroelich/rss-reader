import {feed_id_is_valid} from '/src/objects/feed.js';
import {rdr_badge_refresh} from '/src/ops/rdr-badge-refresh.js';

export function rdr_delete_feed(feed_id, reason_text) {
  if (!feed_id_is_valid(feed_id)) {
    throw new TypeError('Invalid feed id ' + feed_id);
  }

  return new Promise(executor.bind(this, feed_id, reason_text));
}

function executor(feed_id, reason_text, resolve, reject) {
  let entry_ids = [];
  const txn = this.conn.transaction(['feed', 'entry'], 'readwrite');
  txn.oncomplete =
      txn_oncomplete.bind(this, feed_id, reason_text, entry_ids, resolve);
  txn.onerror = _ => reject(txn.error);

  const feed_store = txn.objectStore('feed');

  // Delete the feed
  this.console.debug('Deleting feed with id', feed_id);
  feed_store.delete(feed_id);

  // Delete all entries belonging to the feed
  const entry_store = txn.objectStore('entry');
  const feed_index = entry_store.index('feed');
  const request = feed_index.getAllKeys(feed_id);
  request.onsuccess = event => {
    const keys = request.result;

    for (const id of keys) {
      entry_ids.push(id);
      this.console.debug('Deleting entry', id);
      entry_store.delete(id);
    }
  };
}

function txn_oncomplete(feed_id, reason_text, entry_ids, callback, event) {
  const msg = {type: 'feed-deleted', id: feed_id, reason: reason_text};
  this.channel.postMessage(msg);

  msg.type = 'entry-deleted';
  for (const id of entry_ids) {
    msg.id = id;
    this.channel.postMessage(msg);
  }

  rdr_badge_refresh(this.conn, this.console).catch(this.console.error);
  callback(entry_ids);
}
