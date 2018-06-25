import ModelAccess from '/src/model-access.js';
import assert from '/src/lib/assert.js';
import * as indexeddb from '/src/lib/indexeddb.js';
import * as Feed from '/src/model/feed.js';
import * as sanity from '/src/model/sanity.js';
import {register_test} from '/src/test/test-registry.js';

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
  assert(sanity.is_valid_feed(feed));
  sanity.sanitize_feed(feed);

  const dal = new ModelAccess();
  await dal.connect('write-new-feed-test');

  // Mock a broadcast channel along with a way to monitor messages
  const messages = [];
  const channel = {};
  channel.name = 'stub';
  channel.postMessage = message => messages.push(message);
  channel.close = function() {};
  dal.channel = channel;

  const stored_feed_id = await dal.updateFeed(feed);

  assert(feed.id === stored_feed_id);
  assert(Feed.is_valid_id(feed.id));

  // Make assertions about channel communications
  assert(messages.length === 1);
  assert(typeof messages[0] === 'object');
  assert(messages[0].id === feed.id);
  assert(messages[0].type === 'feed-written');

  // Assert the feed is findable by url
  assert(await dal.getFeed('url', feed_url, true));

  // Assert the feed is findable by id
  const match = await dal.getFeed('id', feed.id, false);

  assert(Feed.is_feed(match));
  assert(match.active === true);
  assert('dateCreated' in match);

  // Created feeds that have never been updated should not have a date updated
  // property set
  assert(!match.hasOwnProperty('dateUpdated'));

  // Teardown the test
  channel.close();
  dal.close();
  await indexeddb.remove(dal.conn.name);
}

register_test(create_feed_test);
