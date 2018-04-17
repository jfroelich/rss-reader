import {feed_id_is_valid, is_feed} from '/src/objects/feed.js';

export function activate_feed(feed_id) {
  if (!feed_id_is_valid(feed_id)) {
    throw new TypeError('Invalid feed id ' + feed_id);
  }

  return new Promise(executor.bind(this, feed_id));
}

function executor(feed_id, resolve, reject) {
  const txn = this.conn.transaction('feed', 'readwrite');
  txn.oncomplete = txn_oncomplete.bind(this, feed_id, resolve);
  txn.onerror = _ => reject(txn.error);

  const store = txn.objectStore('feed');
  const request = store.get(feed_id);
  request.onsuccess = request_onsuccess.bind(this, feed_id);
}

function txn_oncomplete(feed_id, callback, event) {
  this.console.debug('Activated feed', feed_id);
  this.channel.postMessage({type: 'feed-activated', id: feed_id});
  callback();
}

function request_onsuccess(feed_id, event) {
  const feed = event.target.result;
  if (!feed) {
    this.console.warn('Failed to find feed by id', feed_id);
    return;
  }

  if (!is_feed(feed)) {
    this.console.warn('Matched feed object is not a feed', feed_id, feed);
    return;
  }

  if (feed.active) {
    this.console.warn('Tried to activate already-active feed', feed_id);
    return;
  }

  feed.active = true;
  delete feed.deactivationReasonText;
  delete feed.deactivateDate;
  feed.dateUpdated = new Date();

  const store = event.target.source;
  store.put(feed);
}
