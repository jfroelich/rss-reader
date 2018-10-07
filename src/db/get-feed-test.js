import assert from '/src/base/assert.js';

import {create_feed} from './create-feed.js';
import * as feed_utils from './feed-utils.js';
import {get_feed} from './get-feed.js';
import {open} from './open.js';
import {remove} from './remove.js';

export async function get_feed_test() {
  // Test setup
  const db_name = 'get-feed-test';
  await remove(db_name);
  const session = await open(db_name);

  const feed = feed_utils.create_feed_object();
  const url = new URL('a://b.c');
  feed_utils.append_feed_url(feed, url);
  const feed_id = await create_feed(session, feed);

  // Precondition
  assert(feed_utils.is_valid_feed_id(feed_id));

  const stored_feed = await get_feed(session, 'id', feed_id, false);
  assert(stored_feed);

  const stored_feed2 = await get_feed(session, 'url', url, false);
  assert(stored_feed2);

  // Test teardown
  session.close();
  await remove(db_name);
}
