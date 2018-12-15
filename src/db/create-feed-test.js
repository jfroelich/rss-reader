import assert from '/src/assert.js';
import {create_feed} from './create-feed.js';
import * as feed_utils from './feed-utils.js';
import {get_feed} from './get-feed.js';
import {open} from './open.js';
import {remove} from './remove.js';
import * as types from './types.js';

// TODO: test the pathological use cases of create-feed
// TODO: test that creating a feed with missing information fails, or creating
// a feed with other bad format or something also fails, e.g. wrong object
// type, missing url, using an explicit id property should fail, etc
// TODO: test that searching by a different url does not somehow match it
// TODO: test it works without channel
// TODO: test it sends the right messages to channel
// TODO: test it sends expected number of messages to channel
// TODO: test that searching by a different id does not somehow match new feed

// Test the normal usage of create-feed
export async function create_feed_test() {
  // Test setup
  const db_name = 'create-feed-test';
  const session = await open(db_name);

  // Create a dummy feed object, store it, grab its new id
  const feed = feed_utils.create_feed_object();
  const feed_url = new URL('http://www.example.com/example.rss');
  feed_utils.append_feed_url(feed, feed_url);
  const stored_feed_id = await create_feed(session, feed);

  // Verify the generated id looks valid
  assert(feed_utils.is_valid_feed_id(stored_feed_id));

  // Verify the feed is findable by url
  let stored_feed = await get_feed(session, 'url', feed_url, true);
  assert(types.is_feed(stored_feed));

  // Verify the feed is findable by id
  stored_feed = await get_feed(session, 'id', stored_feed_id, false);
  assert(types.is_feed(stored_feed));

  // Test teardown
  session.close();
  await remove(db_name);
}

// Test that uniqueness contraint on feed store url index causes create-feed to
// fail as expected
export async function create_feed_url_constraint_test() {
  // Test setup
  const db_name = 'create-feed-url-constraint-test';
  const session = await open(db_name);

  // TODO: reuse the same URL object here, do not create two url objects, it
  // just leaves open room for inconsistency and is less terse

  // Generate and store a basic feed
  const feed1 = feed_utils.create_feed_object();
  feed_utils.append_feed_url(
      feed1, new URL('http://www.example.com/example.rss'));
  await create_feed(session, feed1);

  // Generate and store a second feed with the same url
  const feed2 = feed_utils.create_feed_object();
  feed_utils.append_feed_url(
      feed2, new URL('http://www.example.com/example.rss'));

  // Call and trap the error. This should fail.
  let create_error;
  try {
    await create_feed(session, feed2);
  } catch (error) {
    create_error = error;
  }

  // Verify that the second attempt to store fails. The error message will look
  // like this: "Unable to add key to index 'urls': at least one key does not
  // satisfy the uniqueness requirements." We use instanceof to at least rule
  // out other error types like TypeError or InvalidStateError (thrown by
  // channel.postMessage) or AssertionError indexedDB throws DOMExceptions
  // specifically. I'd rather not rely on the actual words of the error message
  // and unfortunately indexedDB conflates all of its error types into a single
  // generic error type so just assume any error of that type is good enough.
  assert(create_error instanceof DOMException);

  // Test teardown
  session.close();
  await remove(db_name);
}
