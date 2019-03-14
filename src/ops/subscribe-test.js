import {assert} from '/src/assert.js';
import * as indexeddb_utils from '/src/indexeddb-utils/indexeddb-utils.js';
import {Feed, is_feed} from '/src/model/types/feed.js';
import {Model} from '/src/model/model.js';
import {subscribe} from '/src/ops/subscribe.js';

export async function subscribe_test() {
  const db_name = 'subscribe-test';
  await indexeddb_utils.remove(db_name);

  const session = new Model();
  session.name = db_name;
  await session.open();

  session.channel.close();

  // Inject a fake channel
  const messages = [];
  session.channel = {
    name: 'channel-stub',
    postMessage: message => messages.push(message),
    close: function() {}
  };

  // TODO: use a local url. First, this url no longer is valid because Google
  // discontinued this service. Second, it is bad practice to ping live
  // third-party services and may be a TOS violation of those services. Third,
  // there is little benefit to exercising the network failure case.

  const test_url = 'https://news.google.com/news/rss/?ned=us&gl=US&hl=en';
  const url = new URL(test_url);

  let callback_called = false;
  const feed_stored_callback(feed) {
    callback_called = true;
  };

  // Rethrow subscribe exceptions just like assertion failures by omitting
  // try/catch.
  const feed = await subscribe(
      session, undefined, url, 7000, false, feed_stored_callback);

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
  assert(messages.length === 1);
  assert(messages[0].type === 'feed-created');
  assert(messages[0].id === feed.id);

  session.close();
  await indexeddb_utils.remove(db_name);
}
