import {console_stub} from '/src/lib/console-stub/console-stub.js';
import {list_peek} from '/src/lib/list/list.js';
import {feed_create, feed_is_valid, feed_prepare, is_feed} from '/src/objects/feed.js';

// TODO: simplify args, use context
// TODO: return the object instead of the id, so that caller can access the
// sanitized instance of the input
// TODO: attempting to update a feed with invalid properties where validation is
// done, should not result in an immediately-thrown exception, because failing
// validation is not a programmer error. This should instead result in a
// rejection of the returned promise, more similar to a database call error. The
// only error that should be immediately thrown that is related is when calling
// update on a value that is not a feed, because that is a programmer error.

const channel_stub = {
  name: 'stub',
  postMessage: noop,
  close: noop
};

export function rdr_update_feed(
    conn, channel = channel_stub, console = console_stub, feed, validate = true,
    sanitize = true, set_date_updated = false) {
  // We have two situations, because we do not need to call is_feed when calling
  // feed_is_valid because we know feed_is_valid calls is_feed
  if (validate && !feed_is_valid(feed)) {
    throw new TypeError(
        'Feed has invalid properties or invalid parameter ' + feed);
  } else if (!is_feed(feed)) {
    throw new TypeError('Invalid feed parameter ' + feed);
  }

  console.debug('Updating feed', list_peek(feed.urls));

  let clean_feed;
  if (sanitize) {
    clean_feed = feed_prepare(feed);
  } else {
    clean_feed = Object.assign(feed_create(), feed);
  }

  if (set_date_updated) {
    clean_feed.dateUpdated = new Date();
  }

  return new Promise(executor.bind(null, conn, channel, console, clean_feed));
}

function executor(conn, channel, console, feed, resolve, reject) {
  const shared =
      {id: undefined, channel: channel, console: console, callback: resolve};

  const txn = conn.transaction('feed', 'readwrite');
  txn.oncomplete = txn_oncomplete.bind(txn, shared);
  txn.onerror = _ => reject(txn.error);

  const store = txn.objectStore('feed');
  const request = store.put(feed);
  request.onsuccess = request_onsuccess.bind(request, shared);
}

function txn_oncomplete(shared, event) {
  shared.console.debug('Updated feed, id=%d', shared.id);
  shared.channel.postMessage({type: 'feed-updated', id: shared.id});
  shared.callback(shared.id);
}

function request_onsuccess(shared, event) {
  // On create, the result is the new value of the auto-incremented feed id
  // Not sure what happens on update
  shared.id = event.target.result;
}

function noop() {}
