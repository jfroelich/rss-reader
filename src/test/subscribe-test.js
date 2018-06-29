import {subscribe} from '/src/action/subscribe.js';
import assert from '/src/lib/assert.js';
import * as indexeddb from '/src/lib/indexeddb.js';
import ModelAccess from '/src/model/model-access.js';
import * as Model from '/src/model/model.js';
import {register_test} from '/src/test/test-registry.js';

// TODO: it is wrong to ping google, implement something that tests a local
// file somehow (e.g. a feed that exists within the extension folder)

async function subscribe_test() {
  const test_url = 'https://news.google.com/news/rss/?ned=us&gl=US&hl=en';
  const url = new URL(test_url);

  const ma = new ModelAccess();
  await ma.connect(/* writable */ false, 'subscribe-test');

  const messages = [];
  ma.channel = {
    name: 'channel-stub',
    postMessage: message => messages.push(message),
    close: noop
  };

  // Rethrow subscribe exceptions just like assertion failures by omitting
  // try/catch here.
  const feed = await subscribe(ma, undefined, url, 7000, false);

  // Test the subscription produced the desired result
  assert(typeof feed === 'object');
  assert(Model.is_feed(feed));
  assert(Model.is_valid_feed_id(feed.id));

  // Length may be 1 or 2 (may have redirected and captured new url)
  assert(feed.urls.length);
  assert(feed.urls.includes(url.href));
  assert(feed.active);

  // Assert that the subscription sent out correct messages
  assert(messages.length === 1);
  assert(messages[0].type === 'feed-created');
  assert(messages[0].id === feed.id);

  ma.close();
  await indexeddb.remove(ma.conn.name);
}

function noop() {}

register_test(subscribe_test);
