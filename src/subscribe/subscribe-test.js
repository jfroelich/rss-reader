import {assert} from '/src/assert/assert.js';
import * as db from '/src/db/db.js';
import {indexeddb_remove} from '/src/indexeddb/indexeddb-remove.js';
import * as Feed from '/src/model/feed.js';
import {subscribe} from '/src/subscribe/subscribe.js';
import {register_test} from '/src/test/test-registry.js';

// TODO: it is wrong to ping google, implement something that tests a local
// file somehow (e.g. a feed that exists within the extension folder)

async function subscribe_test() {
  const test_url = 'https://news.google.com/news/rss/?ned=us&gl=US&hl=en';

  const rdb_name = 'subscribe-test';
  let version, timeout;
  const rconn = await db.open_db(rdb_name, version, timeout, console_stub);

  const url = new URL(test_url);

  let message_post_count = 0;
  const chan_stub = {};
  chan_stub.name = 'channel-stub';
  chan_stub.postMessage = _ => message_post_count++;
  chan_stub.close = noop;

  const fetch_timeout = 7000;
  const notify = false;
  const skip_icon_lookup = true;

  // Rethrow subscribe exceptions just like assertion failures by omitting
  // try/catch here.
  const feed = await subscribe(
      rconn, undefined, chan_stub, url, fetch_timeout, notify,
      skip_icon_lookup);

  // Test the subscription produced the desired result
  assert(typeof feed === 'object');
  assert(Feed.is_feed(feed));
  assert(Feed.is_valid_id(feed.id));
  assert(feed.urls.length);
  assert(feed.urls.includes(url.href));
  assert(feed.active);

  // Assert that the subscription sent out messages
  assert(message_post_count > 0);

  // Assert that the new feed is findable by url
  assert(await db.get_feed(rconn, 'url', url, true));

  // Assert that the new feed is findable by id
  const match = await db.get_feed(rconn, 'id', feed.id);
  assert(Feed.is_feed(match));
  assert(Feed.is_valid_id(match.id));
  assert(match.id === feed.id);

  // Cleanup
  rconn.close();
  chan_stub.close();
  await indexeddb_remove(rconn.name);
}

function noop() {}

register_test(subscribe_test);
