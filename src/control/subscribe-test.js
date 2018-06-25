import {subscribe} from '/src/control/subscribe.js';
import ModelAccess from '/src/model-access.js';
import assert from '/src/lib/assert.js';
import * as indexeddb from '/src/lib/indexeddb.js';
import * as Feed from '/src/model/feed.js';
import {register_test} from '/src/test/test-registry.js';

// TODO: it is wrong to ping google, implement something that tests a local
// file somehow (e.g. a feed that exists within the extension folder)

async function subscribe_test() {
  const test_url = 'https://news.google.com/news/rss/?ned=us&gl=US&hl=en';
  const url = new URL(test_url);

  const dal = new ModelAccess();
  await dal.connect('subscribe-test');

  let message_post_count = 0;
  dal.channel = {
    name: 'channel-stub',
    postMessage: function(message) {
      message_post_count++
    },
    close: noop
  };

  // Rethrow subscribe exceptions just like assertion failures by omitting
  // try/catch here.
  const feed = await subscribe(dal, undefined, url, 7000, false);

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
  assert(await dal.getFeed('url', url, true));

  // Assert that the new feed is findable by id
  const match = await dal.getFeed('id', feed.id);
  assert(Feed.is_feed(match));
  assert(Feed.is_valid_id(match.id));
  assert(match.id === feed.id);

  // Cleanup
  dal.close();
  dal.channel.close();
  await indexeddb.remove(dal.conn.name);
}

function noop() {}

register_test(subscribe_test);
