import assert from '/src/assert.js';

import {create_feed} from './create-feed.js';
import * as feed_utils from './feed-utils.js';
import {get_feeds} from './get-feeds.js';
import {open} from './open.js';
import {remove} from './remove.js';

export async function get_feeds_test() {
  // Test setup
  const db_name = 'get-feeds-test';
  await remove(db_name);
  const session = await open(db_name);

  const n = 5;           // number of feeds to store and test against
  let active_count = 0;  // track number of not-inactive

  const create_promises = [];
  for (let i = 0; i < n; i++) {
    const feed = feed_utils.create_feed_object();
    const url = new URL('a://b.c' + i);
    feed_utils.append_feed_url(feed, url);

    // make some inactive
    if (i % 2 === 0) {
      feed.active = false;
    } else {
      active_count++;
    }

    const promise = create_feed(session, feed);
    create_promises.push(promise);
  }
  const ids = await Promise.all(create_promises);

  const all_unsorted_feeds = await get_all_feeds_unsorted(session);
  assert(all_unsorted_feeds.length === n);
  for (const feed of all_unsorted_feeds) {
    assert(feed);
  }

  const all_sorted_feeds = await get_all_feeds_sorted(session);
  assert(all_sorted_feeds.length === n);
  for (const feed of all_sorted_feeds) {
    assert(feed);
  }

  const active_feeds = await get_active_feeds(session);
  assert(active_feeds.length === active_count);
  for (const feed of active_feeds) {
    assert(feed);
    assert(feed.active);
  }

  session.close();
  await remove(db_name);
}

function get_all_feeds_unsorted(session) {
  return get_feeds(session, 'all', false);
}

function get_all_feeds_sorted(session) {
  return get_feeds(session, 'all', true);
}

function get_active_feeds(session) {
  return get_feeds(session, 'active', false);
}
