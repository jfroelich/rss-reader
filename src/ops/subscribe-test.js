import Feed from '/src/db/feed.js';
import * as identifiable from '/src/db/identifiable.js';
import db_open from '/src/db/ops/open.js';
import {is_feed} from '/src/db/types.js';
import assert from '/src/lib/assert.js';
import {Deadline, INDEFINITE} from '/src/lib/deadline.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';
import {subscribe} from '/src/ops/subscribe.js';

export async function subscribe_test() {
  const db_name = 'subscribe-test';
  await indexeddb_utils.remove(db_name);

  const conn = await db_open(db_name);

  // Create a fake channel that records its messages
  const messages = [];
  const channel = {
    name: 'subscribe-test-channel',
    postMessage: message => messages.push(message),
    close: function() {}
  };

  const path = '/src/ops/subscribe-test-feed.xml';
  const local_url_string = chrome.extension.getURL(path);
  const url = new URL(local_url_string);

  let callback_called = false;
  const feed_stored_callback = function(feed) {
    callback_called = true;
  };

  // Setup subscribe parameters
  let iconn = undefined;
  const fetch_feed_timeout = INDEFINITE;
  const notify = false;

  // Rethrow subscribe exceptions just like assertion failures by omitting
  // try/catch.
  const feed = await subscribe(
      conn, iconn, channel, url, fetch_feed_timeout, notify,
      feed_stored_callback);

  // Test the subscription produced the desired result
  assert(feed);
  assert(is_feed(feed));
  assert(identifiable.is_valid_id(feed.id));

  // subscribe should have invoked the callback
  assert(callback_called);

  // Length may be 1 or 2 (may have redirected and captured new url)
  assert(feed.urls.length);
  assert(feed.urls.includes(url.href));

  assert(feed.active);

  // Assert that the subscription sent out correct messages
  assert(messages.length > 0);

  conn.close();
  await indexeddb_utils.remove(db_name);
}
