import {indexeddb_remove} from '/src/lib/indexeddb/indexeddb-remove.js';
import {list_is_empty} from '/src/lib/lang/list.js';
import {append_feed_url, create_feed, get_feed, is_feed, is_valid_feed, is_valid_feed_id, open_reader_db, sanitize_feed, update_feed} from '/src/reader-db.js';
import {assert} from '/src/tests/assert.js';
import {register_test} from '/src/tests/test-registry.js';

// This test exercises the db-write-feed function in the case of adding a new
// feed object to the database. The db-write-feed function should properly store
// the feed in the database, properly assign the feed its new id, and return the
// expected output.

async function create_feed_test() {
  // Create a dummy feed with minimal properties
  const feed = create_feed();
  const feed_url = new URL('http://www.example.com/example.rss');
  append_feed_url(feed, feed_url);

  // Pre-process the feed using the typical sequence of operations
  // TODO: should do tests that both involve and not involve validation and
  // sanitization. For now do a test where both are done.
  // TODO: or maybe this is dumb, and I shouldn't test this here at all
  // actually? I am starting to think this should not be here.
  assert(is_valid_feed(feed));
  sanitize_feed(feed);

  // Intentionally do not set dateUpdated. The property should not exist when
  // storing a new feed. It is allowed to exist, though. It will get deleted.

  // Create a dummy db
  const test_db = 'write-new-feed-test';
  const conn = await open_reader_db(test_db);

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
  assert(is_valid_feed_id(feed.id));

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
  assert(is_feed(match));
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
