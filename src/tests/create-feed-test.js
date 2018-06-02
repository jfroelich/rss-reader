import {db_find_feed_by_id} from '/src/db/db-find-feed-by-id.js';
import {db_find_feed_by_url} from '/src/db/db-find-feed-by-url.js';
import {db_open} from '/src/db/db-open.js';
import {db_validate_feed} from '/src/db/db-validate-feed.js';
import {db_write_feed} from '/src/db/db-write-feed.js';
import {append_feed_url, create_feed, is_feed, is_valid_feed_id} from '/src/feed.js';
import {indexeddb_remove} from '/src/lib/indexeddb/indexeddb-remove.js';
import {list_is_empty} from '/src/lib/lang/list.js';
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
  assert(db_validate_feed(feed));
  db_sanitize_feed(feed);

  // Intentionally do not set dateUpdated. The property should not exist when
  // storing a new feed. It is allowed to exist, though. It will get deleted.

  // Create a dummy db
  const test_db = 'write-new-feed-test';
  const conn = await db_open(test_db);

  // Mock a broadcast channel along with a way to monitor messages
  const messages = [];
  const channel = {};
  channel.name = 'stub';
  channel.postMessage = message => messages.push(message);
  channel.close = function() {};

  // Carry out the operation
  const op = {conn: conn, channel: channel, db_write_feed: db_write_feed};
  const stored_feed_id = await op.db_write_feed(feed);

  // Make assertions about the output of the operation
  assert(is_valid_feed_id(stored_feed_id));


  // Make assertions about channel communications
  assert(messages.length > 0);
  assert(messages.length < 2);
  assert(typeof messages[0] === 'object');
  assert(messages[0].id === stored_feed_id);
  assert(messages[0].type === 'feed-written');

  // Assert the feed exists in the database with the given url
  const read_key_only = true;
  assert(await db_find_feed_by_url(conn, feed_url, read_key_only));

  // Read the feed from the database and assert against read properties
  const match = await db_find_feed_by_id(conn, stored_feed_id);
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
