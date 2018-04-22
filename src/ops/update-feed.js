import {list_peek} from '/src/lib/list/list.js';
import {feed_create, feed_is_valid, feed_prepare, is_feed} from '/src/objects/feed.js';

export function update_feed(feed, options = {}) {
  if (!is_feed(feed)) {
    throw new TypeError('Invalid feed parameter ' + feed);
  }

  this.console.debug('Creating or updating feed', list_peek(feed.urls));

  let clean_feed;
  if (options.sanitize) {
    clean_feed = feed_prepare(feed);
  } else {
    // We still need to clone in the case we are creating a new feed and not
    // sanitizing because we will be mutating the feed object by setting its new
    // id and want to retain functional purity
    clean_feed = Object.assign(feed_create(), feed);
  }

  if (options.set_date_updated) {
    clean_feed.dateUpdated = new Date();
  }

  return new Promise(executor.bind(this, clean_feed, options.validate));
}

function executor(feed, validate, resolve, reject) {
  if (validate && !feed_is_valid(feed)) {
    const error = new Error('Invalid feed ' + feed);
    reject(error);
    return;
  }

  const txn = this.conn.transaction('feed', 'readwrite');
  txn.oncomplete = txn_oncomplete.bind(this, feed, resolve);
  txn.onerror = _ => reject(txn.error);

  const store = txn.objectStore('feed');
  const request = store.put(feed);
  request.onsuccess = _ => feed.id = request.result;
}

function txn_oncomplete(feed, callback, event) {
  this.console.debug('Updated feed', feed.id, list_peek(feed.urls));
  this.channel.postMessage({type: 'feed-updated', id: feed.id});
  callback(feed);
}
