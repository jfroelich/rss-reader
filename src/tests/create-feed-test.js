import {idb_remove} from '/src/lib/idb.js';
import {list_is_empty} from '/src/lib/list.js';
import {append_feed_url, create_feed, is_feed, is_valid_feed_id} from '/src/objects/feed.js';
import {contains_feed} from '/src/ops/contains-feed.js';
import {create_conn} from '/src/ops/create-conn.js';
import {find_feed_by_id} from '/src/ops/find-feed-by-id.js';
import {write_feed} from '/src/ops/write-feed.js';
import {assert} from '/src/tests/assert.js';

// This test exercises the write-feed function in the case of adding a new feed
// object to the database. The write-feed function should properly store
// the feed in the database, properly assign the feed its new id, and return the
// expected output.

export async function create_feed_test() {
  // Create a dummy feed with minimal properties
  const feed = create_feed();
  const feed_url = new URL('http://www.example.com/example.rss');
  append_feed_url(feed, feed_url);

  // Double check our own work at the start, exclude bad setup as a reason for
  // test failure
  assert(is_feed(feed));

  // Create a dummy db
  const test_db = 'write-new-feed-test';
  const conn = await create_conn(test_db);

  // Mock a broadcast channel along with a way to ensure a message is broadcast
  const messages = [];
  const channel = {};
  channel.name = 'stub';
  channel.postMessage = message => messages.push(message);
  channel.close = function() {};

  const op = {};
  op.conn = conn;
  op.channel = channel;
  op.console = console;
  op.write_feed = write_feed;

  // TODO: probably should do tests with different combinations of options. For
  // now just do a test that exercises the true cases to cause the most work
  const options = {};
  options.sanitize = true;
  options.validate = true;

  const stored_feed = await op.write_feed(feed, options);

  // Make assertions about the output of the operation
  assert(typeof stored_feed === 'object', 'output not an object');
  assert(is_feed(stored_feed), 'output failed is-feed check');

  // Make assertions about properties of the output
  assert('id' in stored_feed, 'output missing id property');
  assert(is_valid_feed_id(stored_feed.id), 'output has invalid id');
  assert(!list_is_empty(stored_feed.urls), 'output missing urls');

  // Make assertions about initial state of the output (this is separate than
  // the stored state, that should also be asserted later)
  assert(stored_feed.active === true, 'output feed inactive');
  assert('dateCreated' in stored_feed, 'output feed missing date created');
  assert(
      !stored_feed.hasOwnProperty('dateUpdated'),
      'output feed has date updated');

  // Make assertions about channel communications
  assert(messages.length, 'no message posted');
  assert(messages.length === 1, 'more than one message posted');
  assert(typeof messages[0] === 'object', 'message not an object');
  assert(
      messages[0].id === stored_feed.id, 'message id does not match output id');
  assert(messages[0].hasOwnProperty('type'), 'message missing type property');
  assert(
      messages[0].type === 'feed-written',
      'unexpected message type property ' + messages[0].type);

  // Assert the feed exists in the database
  assert(await contains_feed(conn, {url: feed_url}), 'cannot find feed by url');

  // Read the feed from the database and assert against read properties
  const match = await find_feed_by_id(conn, stored_feed.id);
  assert(is_feed(match), 'feed loaded from db is not a feed');
  assert(is_valid_feed_id(match.id), 'feed loaded from db has invalid id');
  assert(
      match.id === stored_feed.id,
      'feed id loaded from db does not match output id');

  // Test teardown
  conn.close();
  channel.close();  // a no-op, but guard against future changes
  await idb_remove(conn.name);
}