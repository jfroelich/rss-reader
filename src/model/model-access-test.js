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

// Exercise the typical createFeeds case
async function create_feeds_test() {
  const msgs = [];
  const ma = new ModelAccess();
  await ma.connect('create-feeds-test');
  ma.channel = {name: 'stub', postMessage: m => msgs.push(m), close: noop};

  const num_feeds = 3;
  const feeds = [];
  for (let i = 0; i < num_feeds; i++) {
    const feed = Model.create_feed();
    Model.append_feed_url(feed, new URL('a://b.c' + i));
    feeds.push(feed);
  }

  const ids = await ma.createFeeds(feeds);
  assert(ids.length === num_feeds, '' + ids);

  const stored_feeds = await ma.getFeeds('all', /* title-sort */ false);
  assert(stored_feeds.length === num_feeds, '' + stored_feeds);

  // Load the feeds individually by id, albeit concurrently. This exercises the
  // id check, which getFeeds above does not.
  const feeds_by_id = await Promise.all(ids.map(id => ma.getFeed('id', id)));

  for (const feed of feeds_by_id) {
    assert(Model.is_feed(feed));
    assert(Model.is_valid_feed_id(feed.id));
    assert(feed.active);
    assert(feed.dateCreated);
    assert(feed.dateUpdated === undefined);
  }

  assert(msgs.length === num_feeds);
  assert(msgs[0].type === 'feed-created');
  assert(msgs[0].id === feeds_by_id[0].id);

  // Teardown the test
  ma.channel.close();
  ma.close();
  await indexeddb.remove(ma.conn.name);
}

async function activate_feed_test() {
  const msgs = [];
  const ma = new ModelAccess();
  await ma.connect('activate-feed-test');
  ma.channel = {name: 'stub', postMessage: msg => msgs.push(msg), close: noop};

  const feed = Model.create_feed();
  feed.active = false;
  Model.append_feed_url(feed, new URL('a://b.c'));

  const id = await ma.createFeed(feed);
  await ma.activateFeed(id);
  const stored_feed = await ma.getFeed('id', id, false);

  assert(Model.is_feed(stored_feed));
  assert(stored_feed.active === true);
  assert(stored_feed.deactivateDate === undefined);
  assert(stored_feed.deactivationReasonText === undefined);
  assert(msgs.length === 2);  // create + activate
  assert(msgs[1].type === 'feed-activated');
  assert(msgs[1].id === stored_feed.id);

  // Activating a feed that is already active should fail
  // NOTE: so I sort of learned an important lesson about the leaky abstraction
  // that is promises. My original understanding was that when an exception is
  // thrown inside of a promise, it is translated into a rejection. That
  // understanding is incorrect. There is more nuance. In particular, only
  // immediately-thrown exceptions are translated automatically into rejections.
  // If an error is thrown in a later event loop iteration (e.g. next tick)
  // while within the executor of the promise, such as after setTimeout
  // resolves, or after an indexedDB request event occurs, then the error is NOT
  // transformed into a rejection. It remains an uncaught exception that leaves
  // the promise in an unsettled state (the promise never rejects). Therefore,
  // all promises that do work that occurs after the current event loop epoch
  // has elapsed must use try/catch in non-immediate contexts or somehow avoid
  // throwing errors entirely. All code that occurs in a later tick from within
  // a promise is untrustworthy.

  // TODO: convert model-access to reject instead of assert in the above
  // situation, as a partial solution.
  // TODO: perform a thorough review of all promises that do deferred work.

  let activation_error;
  try {
    await ma.activateFeed(id);
  } catch (error) {
    activation_error = error;
  }

  // Assert that the activation attempt failed as expected
  assert(activation_error);

  ma.channel.close();
  ma.close();
  await indexeddb.remove(ma.conn.name);
}

function noop() {}

register_test(create_feed_test);
register_test(create_feed_url_constraint_test);
register_test(create_feeds_test);
register_test(activate_feed_test);
