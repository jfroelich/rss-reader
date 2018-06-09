import {indexeddb_remove} from '/src/lib/indexeddb/indexeddb-remove.js';
import {get_feed, is_feed, is_valid_feed_id, open_reader_db} from '/src/reader-db.js';
import {subscribe} from '/src/subscribe.js';
import {assert} from '/src/tests/assert.js';
import {register_test} from '/src/tests/test-registry.js';


// TODO: it is wrong to ping google, implement something that tests a local
// file somehow (e.g. a feed that exists within the extension folder)

async function subscribe_test() {
  const test_url = 'https://news.google.com/news/rss/?ned=us&gl=US&hl=en';

  const rdb_name = 'subscribe-test';
  let version, timeout;
  const rconn = await open_reader_db(rdb_name, version, timeout, console_stub);

  const url = new URL(test_url);
  const options = {fetch_timeout: 7000, notify: false, skip_icon_lookup: true};

  let message_post_count = 0;
  const channel_stub = {};
  channel_stub.name = 'channel-stub';
  channel_stub.postMessage = _ => message_post_count++;
  channel_stub.close = noop;

  const feed = await subscribe(rconn, undefined, channel_stub, url, options);

  // Test the subscription produced the desired result
  assert(typeof feed === 'object', 'subscribe did not emit an object ' + feed);
  assert(is_feed(feed), 'subscribe did not emit object of correct type');
  assert(is_valid_feed_id(feed.id));
  assert(feed.urls.length, 'subscribe produced feed without urls');
  assert(feed.urls.includes(url.href), 'subscribed feed missing input url');
  assert(feed.active, 'subscribed feed not initially active');

  // Assert that the subscription sent out messages
  assert(message_post_count > 0, 'no message posted');

  // Assert that the new feed is findable by url
  assert(await get_feed(rconn, 'url', url, true));

  // Assert that the new feed is findable by id
  const match = await get_feed(rconn, 'id', feed.id);
  assert(is_feed(match), 'subscribed feed read did not emit feed type');
  assert(is_valid_feed_id(match.id), 'subscribed feed has invalid id');
  assert(match.id === feed.id, 'subscribed feed vs stored feed id mismatch');

  // Cleanup
  rconn.close();
  channel_stub.close();
  await indexeddb_remove(rconn.name);
}

function noop() {}

register_test(subscribe_test);
