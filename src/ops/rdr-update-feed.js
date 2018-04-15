import {list_peek} from '/src/lib/list/list.js';
import {feed_create, feed_is_valid, feed_prepare, is_feed} from '/src/objects/feed.js';

export function rdr_update_feed(feed, options = {}) {
  if (options.validate && !feed_is_valid(feed)) {
    throw new TypeError(
        'Feed has invalid properties or invalid parameter ' + feed);
  } else if (!is_feed(feed)) {
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

  return new Promise(executor.bind(this, clean_feed));
}

function executor(feed, resolve, reject) {
  const txn = this.conn.transaction('feed', 'readwrite');
  txn.oncomplete = txn_oncomplete.bind(this, feed, resolve);
  txn.onerror = _ => reject(txn.error);

  const request = txn.objectStore('feed').put(feed);
  request.onsuccess = request_onsuccess.bind(this, feed);
}

function txn_oncomplete(feed, callback, event) {
  this.console.debug('Updated feed', feed.id);
  this.channel.postMessage({type: 'feed-updated', id: feed.id});
  callback(feed);
}

function request_onsuccess(feed, event) {
  // TEMP: reviewing what happens in case of put where id exists
  if ('id' in feed) {
    // use the actual console
    console.debug('put feed result when id exists is', event.target.result);
  }

  // Set the auto-incremented id value in the case of creation and ignore in
  // the case of update
  if (!('id' in feed)) {
    feed.id = event.target.result;
  }
}
