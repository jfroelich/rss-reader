import {list_peek} from '/src/lib/list/list.js';
import {feed_create, feed_is_valid, feed_prepare, is_feed} from '/src/objects/feed.js';

export function rdr_update_feed(feed, options = {}) {
  if (options.validate && !feed_is_valid(feed)) {
    throw new TypeError(
        'Feed has invalid properties or invalid parameter ' + feed);
  } else if (!is_feed(feed)) {
    throw new TypeError('Invalid feed parameter ' + feed);
  }

  this.console.debug('Updating feed', list_peek(feed.urls));

  let clean_feed;
  if (options.sanitize) {
    clean_feed = feed_prepare(feed);
  } else {
    clean_feed = Object.assign(feed_create(), feed);
  }

  if (options.set_date_updated) {
    clean_feed.dateUpdated = new Date();
  }

  return new Promise(executor.bind(this, clean_feed));
}

function executor(feed, resolve, reject) {
  // Share the id across the functions by reference
  const id_holder = {id: undefined};

  const txn = this.conn.transaction('feed', 'readwrite');
  txn.oncomplete = txn_oncomplete.bind(this, id_holder, resolve);
  txn.onerror = _ => reject(txn.error);

  const request = txn.objectStore('feed').put(feed);
  request.onsuccess = request_onsuccess.bind(this, id_holder);
}

function txn_oncomplete(id_holder, callback, event) {
  this.console.debug('Updated feed, id=%d', id_holder.id);
  this.channel.postMessage({type: 'feed-updated', id: id_holder.id});
  callback(id_holder.id);
}

function request_onsuccess(shared, event) {
  id_holder.id = event.target.result;
}
