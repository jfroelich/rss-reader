import {assert} from '/src/assert.js';
import db_open from '/src/db/ops/db-open.js';
import {Feed, is_feed} from '/src/db/types/feed.js';
import {Deadline} from '/src/deadline.js';
import * as indexeddb_utils from '/src/indexeddb-utils/indexeddb-utils.js';
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

  const test_url = 'https://news.google.com/news/rss/?ned=us&gl=US&hl=en';
  const url = new URL(test_url);

  let callback_called = false;
  const feed_stored_callback = function(feed) {
    callback_called = true;
  };

  // Rethrow subscribe exceptions just like assertion failures by omitting
  // try/catch.
  let iconn = undefined;
  const feed = await subscribe(
      conn, iconn, channel, url, new Deadline(7000), false,
      feed_stored_callback);

  // Test the subscription produced the desired result
  assert(feed);
  assert(is_feed(feed));
  assert(Feed.isValidId(feed.id));

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
