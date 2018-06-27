import assert from '/src/lib/assert.js';
import * as indexeddb from '/src/lib/indexeddb.js';
import ModelAccess from '/src/model/model-access.js';
import * as Model from '/src/model/model.js';
import {register_test} from '/src/test/test-registry.js';

// Exercise the createFeed function in the typical case
async function create_feed_test() {
  // Create a dummy feed with minimal properties
  const feed = Model.create_feed();
  const feed_url = new URL('http://www.example.com/example.rss');
  Model.append_feed_url(feed, feed_url);

  const ma = new ModelAccess();
  await ma.connect('create-feed-test');

  // Mock a broadcast channel along with a way to monitor messages
  const messages = [];
  const channel = {};
  channel.name = 'stub';
  channel.postMessage = message => messages.push(message);
  channel.close = function() {};
  ma.channel = channel;

  const stored_feed_id = await ma.createFeed(feed);

  assert(Model.is_valid_feed_id(stored_feed_id));

  // Make assertions about channel communications
  assert(messages.length === 1);
  assert(typeof messages[0] === 'object');
  assert(messages[0].id === stored_feed_id);
  assert(messages[0].type === 'feed-created');

  // Assert the feed is findable by url
  assert(await ma.getFeed('url', feed_url, true));

  // Assert the feed is findable by id, and this time save the read feed to
  // assert against it.
  const stored_feed = await ma.getFeed('id', stored_feed_id, false);

  assert(Model.is_feed(stored_feed));

  // New feeds should be active by default
  assert(stored_feed.active === true);

  // New feeds should have a dateCreated set
  assert(stored_feed.dateCreated);

  // New feeds that have never been updated should not have a dateUpdated
  assert(stored_feed.dateUpdated === undefined);

  // Teardown the test
  ma.channel.close();
  ma.close();
  await indexeddb.remove(ma.conn.name);
}

// Test that double url insert fails, it is expected to throw a
// DOMException with a message about a constraint error because of the unique
// constraint on the url index of the feed store
async function create_feed_url_constraint_test() {
  const feed1 = Model.create_feed();
  Model.append_feed_url(feed1, new URL('http://www.example.com/example.rss'));

  const feed2 = Model.create_feed();
  Model.append_feed_url(feed2, new URL('http://www.example.com/example.rss'));

  const ma = new ModelAccess();
  await ma.connect('create-feed-url-constraint-test');
  ma.channel = {name: 'stub', postMessage: noop, close: noop};

  // Store the first feed
  await ma.createFeed(feed1);

  // Now attempt to store the second feed, trapping the error
  let create_error = null;
  try {
    await ma.createFeed(feed2);
  } catch (error) {
    create_error = error;
  }

  // Assert that storing the second feed failed. The error message is something
  // like the following: "Unable to add key to index 'urls': at least one key
  // does not satisfy the uniqueness requirements."
  assert(create_error instanceof DOMException);

  // Teardown the test
  ma.channel.close();
  ma.close();
  await indexeddb.remove(ma.conn.name);
}

function noop() {}

register_test(create_feed_test);
register_test(create_feed_url_constraint_test);
