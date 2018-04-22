import {idb_remove} from '/src/lib/idb.js';
import {feed_id_is_valid, is_feed} from '/src/objects/feed.js';
import {contains_feed} from '/src/ops/contains-feed.js';
import {create_conn} from '/src/ops/create-conn.js';
import {find_feed_by_id} from '/src/ops/find-feed-by-id.js';
import {subscribe} from '/src/ops/subscribe.js';
import {assert, register_test} from '/src/tests/test.js';

async function basic_subscribe_test() {
  let message_post_count = 0;

  const channel_stub = {};
  channel_stub.name = 'channel-stub';
  channel_stub.postMessage = function channel_stub_post_message(message) {
    console.debug(
        '%s: fake-posting message %o', channel_stub_post_message.name, message);
    message_post_count++;
  };
  channel_stub.close = noop;

  const rdb_name = 'subscribe-test';
  let version = undefined;
  let timeout = undefined;

  const rconn = await create_conn(rdb_name, version, timeout, console);

  const url = new URL('https://news.google.com/news/rss/?ned=us&gl=US&hl=en');
  const subscribe_options = {
    fetch_timeout: 7000,
    notify: false,
    await_poll: true,
    skip_poll: true,
    skip_icon_lookup: true
  };

  const subscribe_op = {
    rconn: rconn,
    channel: channel_stub,
    console: console,
    subscribe: subscribe
  };

  const feed = await subscribe_op.subscribe(url, subscribe_options);
  console.debug('subscribed feed: %o', feed);
  assert(typeof feed === 'object', 'subscribe did not emit an object ' + feed);
  assert(is_feed(feed), 'subscribe did not emit object of correct type');
  assert(feed_id_is_valid(feed.id));
  assert(feed.urls.length, 'subscribe produced feed without urls');
  assert(feed.urls.includes(url.href), 'subscribed feed missing input url');
  assert(feed.active, 'subscribed feed not initially active');
  assert(message_post_count, 'subscribed feed did not post message');

  const query = {url: url};
  assert(await contains_feed(rconn, query), 'cannot find feed by url');

  const match = await find_feed_by_id(rconn, feed.id);
  assert(is_feed(match), 'subscribed feed read did not emit feed type');
  assert(feed_id_is_valid(match.id), 'subscribed feed has invalid id');
  assert(match.id === feed.id, 'subscribed feed vs stored feed id mismatch');

  // Cleanup
  rconn.close();
  await idb_remove(rconn.name, console);
}

function noop() {}

register_test(basic_subscribe_test);
