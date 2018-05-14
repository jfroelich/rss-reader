import {db_contains_feed} from '/src/db/db-contains-feed.js';
import {db_find_feed_by_id} from '/src/db/db-find-feed-by-id.js';
import {db_open} from '/src/db/db-open.js';
import {is_feed, is_valid_feed_id} from '/src/feed.js';
import {console_stub} from '/src/lib/console-stub.js';
import {idb_remove} from '/src/lib/idb.js';
import {subscribe} from '/src/subscribe.js';
import {assert} from '/src/tests/assert.js';

// TODO: it is wrong to ping google, implement something that tests a local
// file somehow (e.g. a feed that exists within the extension)

export async function subscribe_test() {
  const test_url = 'https://news.google.com/news/rss/?ned=us&gl=US&hl=en';

  const rdb_name = 'subscribe-test';
  let version, timeout;
  const rconn = await db_open(rdb_name, version, timeout, console_stub);

  const url = new URL(test_url);
  const options = {fetch_timeout: 7000, notify: false, skip_icon_lookup: true};

  let message_post_count = 0;
  const channel_stub = {};
  channel_stub.name = 'channel-stub';
  channel_stub.postMessage = _ => message_post_count++;

  const subscribe_op = {
    rconn: rconn,
    channel: channel_stub,
    console: console,
    subscribe: subscribe
  };

  const feed = await subscribe_op.subscribe(url, options);

  // Test the subscription produced the desired result
  assert(typeof feed === 'object', 'subscribe did not emit an object ' + feed);
  assert(is_feed(feed), 'subscribe did not emit object of correct type');
  assert(is_valid_feed_id(feed.id));
  assert(feed.urls.length, 'subscribe produced feed without urls');
  assert(feed.urls.includes(url.href), 'subscribed feed missing input url');
  assert(feed.active, 'subscribed feed not initially active');

  // Test the subscription sent out messages
  assert(message_post_count, 'no message posted');

  // Test the new feed is findable by url
  const query = {url: url};
  assert(await db_contains_feed(rconn, query), 'cannot find feed by url');

  // Test the new feed is findable by id
  const match = await db_find_feed_by_id(rconn, feed.id);
  assert(is_feed(match), 'subscribed feed read did not emit feed type');
  assert(is_valid_feed_id(match.id), 'subscribed feed has invalid id');
  assert(match.id === feed.id, 'subscribed feed vs stored feed id mismatch');

  // Cleanup
  rconn.close();
  await idb_remove(rconn.name);
}
