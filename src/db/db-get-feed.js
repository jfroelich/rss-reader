import {create_feed, is_valid_feed_id} from '/src/feed.js';

// TODO: write tests

const supported_modes = ['url', 'id'];
const default_mode = 'id';

// Find a feed in the database
// @param conn {IDBDatabase} an open database connection
// @param options {Object} optional
// @option mode the type of query, if mode is undefined then it is query by id,
// modes are 'url', 'id', lowercase only
// @option id {Number} the feed id to look for, required when mode is undefined
// or 'id'
// @option url {URL} the url to look for, required when mode is 'url'
// @option key_only {Boolean} if true then only the matching key is loaded
export async function db_get_feed(conn, options = {}) {
  return new Promise(executor.bind(null, conn, options));
}

function executor(conn, options, resolve, reject) {
  const mode = options.mode || default_mode;
  const url = options.url;
  const id = options.id;
  const key_only = options.key_only;

  assert(supported_modes.includes(mode));

  // Either the mode is some other mode than url mode, or it is url mode with a
  // valid url
  assert(mode !== 'url' || is_url(url));

  // Either the mode is some other mode than id mode, or it is id mode with a
  // valid feed id
  assert(mode !== 'id' || is_valid_feed_id(id));

  // Either the mode is some other mode than id mode, or it is id mode and key
  // only is false. Querying for a feed's id with its id is nonsensical and
  // therefore a programmer error.
  assert(
      mode !== 'id' || !key_only,
      'Cannot load key only when querying for feed by id');

  const txn = conn.transaction('feed');
  txn.onerror = _ => reject(txn.error);
  const store = txn.objectStore('feed');

  // TODO: what if instead I use two different request_onsuccess handlers,
  // one for getKey and one for get. This reduces the branching in the handler.
  // Would it be clearer? More or less performant?

  let request;
  if (mode === 'url') {
    const index = store.index('urls');
    const href = url.href;
    request = key_only ? index.getKey(href) : index.get(href);
  } else {
    request = store.get(id);
  }
  request.onsuccess = request_onsuccess.bind(request, options, resolve);
}

// Handle the result of the get request
function request_onsuccess(options, callback, event) {
  let feed;
  if (options.key_only) {
    // Mimic a loaded feed (if found)
    const feed_id = event.target.result;
    if (is_valid_feed_id(feed_id)) {
      feed = create_feed();
      feed.id = feed_id;
    }
  } else {
    feed = event.target.result;
  }

  callback(feed);
}

// Return true if the value looks like a URL
// Using duck typing over instanceof.
function is_url(value) {
  return value && typeof value.href === 'string';
}

// Throw an error if condition is falsy with optional message
function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion error');
}
