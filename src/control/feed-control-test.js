import {assert} from '/src/assert/assert.js';
import * as feed_control from '/src/control/feed-control.js';
import {get_feed} from '/src/dal/get-feed.js';
import {update_feed} from '/src/dal/update-feed.js';
import * as Feed from '/src/data-layer/feed.js';
import * as db from '/src/dal/open-db.js';
import {indexeddb_remove} from '/src/indexeddb/indexeddb-remove.js';
import * as array from '/src/lang/array.js';
import {register_test} from '/src/test/test-registry.js';

async function subscribe_test() {
  // TODO: it is wrong to ping google, implement something that tests a local
  // file somehow (e.g. a feed that exists within the extension folder)
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
  const feed = await feed_control.subscribe(
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
  assert(await get_feed(rconn, 'url', url, true));

  // Assert that the new feed is findable by id
  const match = await get_feed(rconn, 'id', feed.id);
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


// Exercises the db-write-feed function in the case of adding a new feed object
// to the database. The db-write-feed function should properly store the feed in
// the database, properly assign the feed its new id, and return the expected
// output.
async function create_feed_test() {
  // Create a dummy feed with minimal properties
  const feed = Feed.create();
  const feed_url = new URL('http://www.example.com/example.rss');
  Feed.append_url(feed, feed_url);

  // Pre-process the feed using the typical sequence of operations
  // TODO: should do tests that both involve and not involve validation and
  // sanitization. For now do a test where both are done.
  // TODO: or maybe this is dumb, and I shouldn't test this here at all
  // actually? I am starting to think this should not be here.
  assert(Feed.is_valid(feed));
  feed_control.sanitize_feed(feed);

  // Intentionally do not set dateUpdated. The property should not exist when
  // storing a new feed. It is allowed to exist, though. It will get deleted.

  // Create a dummy db
  const test_db = 'write-new-feed-test';
  const conn = await db.open_db(test_db);

  // Mock a broadcast channel along with a way to monitor messages
  const messages = [];
  const channel = {};
  channel.name = 'stub';
  channel.postMessage = message => messages.push(message);
  channel.close = function() {};

  const stored_feed_id = await update_feed(conn, channel, feed);

  // Make assertions about the function output

  // update_feed both returns the new id, and sets the id of the input. They
  // should be the same value
  assert(feed.id === stored_feed_id);

  // Given that now we know there the same, validate one of them to validate
  // both as valid
  assert(Feed.is_valid_id(feed.id));

  // Make assertions about channel communications

  // There should be one message
  assert(messages.length > 0);
  assert(messages.length < 2);

  // The message is an object
  assert(typeof messages[0] === 'object');

  // The message has the correct properties
  assert(messages[0].id === feed.id);
  assert(messages[0].type === 'feed-written');

  // Assert the feed exists in the database with the given url
  assert(await get_feed(conn, 'url', feed_url, true));

  // TODO: could just store above result (not keyonly), and assert against it.
  // We know it will be findable by id, i think?

  // Read the feed from the database and assert against read properties
  const match = await get_feed(conn, 'id', feed.id, false);
  assert(Feed.is_feed(match));
  assert(match.active === true);
  assert('dateCreated' in match);

  // Created feeds that have never been updated should not have a date updated
  // property set
  assert(!match.hasOwnProperty('dateUpdated'));

  // Teardown the test
  channel.close();
  conn.close();
  await indexeddb_remove(conn.name);
}

register_test(create_feed_test);
