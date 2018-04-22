import {idb_remove} from '/src/lib/idb/idb.js';
// import {create_icon_conn} from '/src/ops/create-icon-conn.js';
import {feed_id_is_valid, is_feed} from '/src/objects/feed.js';
import {contains_feed} from '/src/ops/contains-feed.js';
import {create_conn} from '/src/ops/create-conn.js';
import {find_feed_by_id} from '/src/ops/find-feed-by-id.js';
import {subscribe} from '/src/ops/subscribe.js';

// TODO: side note, should rename feed_id_is_valid to is_valid_feed_id



async function test() {
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
  // For now test without icon connection

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
  console.assert(
      typeof feed === 'object', 'no feed object produced by subscribe', feed);
  console.assert(
      is_feed(feed), 'subscribe did not produce object of correct type');

  console.assert(feed_id_is_valid(feed.id));

  console.assert(feed.urls.length > 0, 'feed.urls is empty');
  console.assert(feed.urls.includes(url.href));
  console.assert(feed.active);

  console.assert(message_post_count > 0);

  // Check that the feed exists in the database by url
  const query = {url: url};
  const exists = await contains_feed(rconn, query);
  console.assert(exists, 'did not find subscribed feed by url');


  // Check that the feed exists in the database by id
  const match = await find_feed_by_id(rconn, feed.id);
  console.assert(is_feed(match), '%s: no match', find_feed_by_id.name);
  console.assert(feed_id_is_valid(match.id), 'matched feed missing id?', match);
  console.assert(
      match.id === feed.id, 'feed ids do not match, match %d feed %d', match.id,
      feed.id);

  // TODO: unsusbcribe, check that it completes without error

  rconn.close();
  await idb_remove(rconn.name, console);

  // iconn.close();
  // await idb_remove(iconn.name);
  console.debug('Test complete');
  return true;
}

function noop() {}

window.test = test;
