import assert from '/src/assert.js';
import {create_feed} from '/src/db/create-feed.js';
import {deactivate_feed} from '/src/db/deactivate-feed.js';
import * as feed_utils from '/src/db/feed-utils.js';
import {get_feed} from '/src/db/get-feed.js';
import {open} from '/src/db/open.js';
import {remove} from '/src/db/remove.js';
import * as types from '/src/db/types.js';

// TODO: this test is currently only minimal, to at least have the ordinary
// case exercised. I need to test other cases and pathological cases.

export async function deactivate_feed_test() {
  const db_name = 'deactivate-feed-test';
  await remove(db_name);
  const session = await open(db_name);

  const feed = feed_utils.create_feed_object();
  const url = new URL('a://b.c');
  feed_utils.append_feed_url(feed, url);

  feed.active = true;

  const feed_id = await create_feed(session, feed);

  const messages = [];
  const channel = {};
  channel.postMessage = message => messages.push(message);
  channel.close = noop;

  session.channel = channel;

  await deactivate_feed(session, feed_id, 'testing');

  const stored_feed = await get_feed(session, 'id', feed_id, false);

  // Deactivating the feed should not somehow make it not findable by id
  assert(stored_feed);

  // Deactivating the feed should somehow not destroy type information
  assert(types.is_feed(stored_feed));

  // Deactivating the feed should result in the active property being the value
  // of false. Not just undefined, not just key deleted.
  assert(stored_feed.active === false);

  // Deactivating a feed should have resulted in storing a date
  assert(stored_feed.deactivateDate);

  // The deactivation date should never be in the future
  const now = new Date();
  assert(stored_feed.deactivateDate <= now);

  // Tear down
  session.close();
  await remove(db_name);
}

function noop() {}
