import assert from '/src/assert/assert.js';
import {create_feeds} from '/src/db/create-feeds.js';
import * as feed_utils from '/src/db/feed-utils.js';
import {get_feed} from '/src/db/get-feed.js';
import {get_feeds} from '/src/db/get-feeds.js';
import {open} from '/src/db/open.js';
import {remove} from '/src/db/remove.js';
import * as types from '/src/db/types.js';

// TODO: test behavior when two or more feeds have identical urls

export async function create_feeds_test() {
  // Test setup
  const db_name = 'create-feeds-test';
  const session = await open(db_name);

  // Create some feed objects with different urls
  const num_feeds = 3;
  const feeds = [];
  for (let i = 0; i < num_feeds; i++) {
    const feed = feed_utils.create_feed_object();
    feed_utils.append_feed_url(feed, new URL('a://b.c' + i));
    feeds.push(feed);
  }

  // Exercise the tested function
  const ids = await create_feeds(session, feeds);

  // Verify the number of results is as expected
  assert(ids.length === num_feeds);

  const stored_feeds = await get_feeds(session, 'all', false);
  assert(stored_feeds.length === num_feeds);

  // Exercise the id check
  const get_proms = ids.map(id => get_feed(session, 'id', id, false));
  const feeds_by_id = await Promise.all(get_proms);
  for (const feed of feeds_by_id) {
    assert(types.is_feed(feed));
    assert(feed_utils.is_valid_feed_id(feed.id));
  }

  // Test teardown
  session.close();
  await remove(db_name);
}
