import {feed_id_is_valid, is_feed} from '/src/objects/feed.js';

export function rdr_deactivate_feed(feed_id, reason) {
  if (!feed_id_is_valid(feed_id)) {
    throw new TypeError('Invalid feed id ' + feed_id);
  }
  return new Promise(executor.bind(this, feed_id, reason));
}

function executor(feed_id, reason, resolve, reject) {
  const txn = this.conn.transaction('feed', 'readwrite');
  txn.oncomplete = txn_oncomplete.bind(this, feed_id, resolve);
  txn.onerror = _ => reject(txn.error);

  const store = txn.objectStore('feed');
  const request = store.get(feed_id);
  request.onsuccess = request_onsuccess.bind(this, feed_id, reason);
}

function txn_oncomplete(feed_id, callback, event) {
  this.console.debug('Deactivated feed', feed_id);
  this.channel.postMessage({type: 'feed-deactivated', id: feed_id});
  callback();
}

function request_onsuccess(feed_id, reason, event) {
  const feed = event.target.result;
  const store = event.target.source;

  if (!feed) {
    this.console.warn('Failed to find feed', feed_id);
    return;
  }

  if (!is_feed(feed)) {
    this.console.warn('Matched object not a feed', feed_id, feed);
    return;
  }

  if (feed.active === false) {
    this.console.warn('Feed is already inactive', feed_id, feed);
    return;
  }

  feed.active = false;
  feed.deactivationReasonText = reason;
  const current_date = new Date();
  feed.deactivationDate = current_date;
  feed.dateUpdated = current_date;
  store.put(feed);
}
