import assert from '/src/assert.js';
import {create_feed} from '/src/db/create-feed.js';
import {delete_feed} from '/src/db/delete-feed.js';
import * as feed_utils from '/src/db/feed-utils.js';
import {get_feed} from '/src/db/get-feed.js';
import {open} from '/src/db/open.js';
import {remove} from '/src/db/remove.js';

// TODO: test what happens when concurrently deleting feeds

// TODO: need to test the effect of deleting a feed that also has entries.
// there should be entry messages too, and also, entries should not be left
// behind, the wrong entries should not be deleted, etc.

export async function delete_feed_test() {
  // Test setup
  const db_name = 'delete-feed-test';
  await remove(db_name);
  const session = await open(db_name);

  // Create and store a feed
  const feed1 = feed_utils.create_feed_object();
  const url1 = new URL('http://www.example.com/foo.xml');
  feed_utils.append_feed_url(feed1, url1);
  const feed_id1 = await create_feed(session, feed1);

  // Create and store a second feed
  const feed2 = feed_utils.create_feed_object();
  const url2 = new URL('http://www.example.com/bar.xml');
  feed_utils.append_feed_url(feed2, url2);
  const feed_id2 = await create_feed(session, feed2);

  const messages = [];
  const channel = {};
  channel.name = 'delete-feed-test-channel';
  channel.postMessage = message => messages.push(message);
  channel.close = noop;

  session.channel = channel;

  const delete_reason = 'test';

  // Remove the first feed
  await delete_feed(session, feed_id1, delete_reason);

  // Paranoia
  session.channel = undefined;

  // feed1 should no longer exist in the database. I assume that trying to get
  // the feed by its id is enough of a test to confirm that.
  const stored_feed1 = await get_feed(session, 'id', feed_id1, false);
  assert(!stored_feed1);

  // removing feed1 should not have somehow affected feed2
  const stored_feed2 = await get_feed(session, 'id', feed_id2, false);
  assert(stored_feed2);

  // Test messaging. Because feed1 has no entries we only expect 1 message.
  assert(messages.length === 1);
  const first_message = messages[0];
  assert(typeof first_message === 'object');
  assert(first_message.type === 'feed-deleted');
  assert(first_message.id === feed_id1);
  assert(first_message.reason === delete_reason);

  // Remove a feed that does not exist. delete_feed should still work, it just
  // does nothing. Notably, delete_feed does not require the feed to exist, and
  // this is just confirming that contractual representation.
  // Do this before removing the other feed so that this is tested on a
  // non-empty object store, if that ever matters?
  const fictional_feed_id = 123456789;
  await delete_feed(session, fictional_feed_id, delete_reason);

  // Remove the second feed. This should occur without error. Removing the
  // second feed after having removed the first should not fail. Calling
  // delete_feed without a channel should not fail. Not providing a reason
  // should not cause an error.
  await delete_feed(session, feed_id2);

  // Test teardown
  session.close();
  await remove(db_name);
}

function noop() {}
