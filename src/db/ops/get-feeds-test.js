import {Feed} from '/src/db/object/feed.js';
import create_feed from '/src/db/ops/create-feed.js';
import get_feeds from '/src/db/ops/get-feeds.js';
import db_open from '/src/db/ops/open.js';
import assert from '/src/lib/assert.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';

export async function get_feeds_test() {
  const db_name = 'get-feeds-test';
  await indexeddb_utils.remove(db_name);

  const conn = await db_open(db_name);

  const n = 5;           // number of feeds to store and test against
  let active_count = 0;  // track number of not-inactive
  const create_promises = [];
  for (let i = 0; i < n; i++) {
    const feed = new Feed();
    const url = new URL('a://b.c' + i);
    feed.appendURL(url);
    // make some inactive
    if (i % 2 === 0) {
      feed.active = false;
    } else {
      active_count++;
    }

    create_promises.push(create_feed(conn, undefined, feed));
  }
  const ids = await Promise.all(create_promises);

  const unsorted = await get_feeds(conn, 'all', false);
  assert(unsorted.length === n);
  for (const feed of unsorted) {
    assert(feed);
  }

  const sorted = await get_feeds(conn, 'all', true);
  assert(sorted.length === n);
  for (const feed of sorted) {
    assert(feed);
  }

  const actives = await get_feeds(conn, 'active', false);
  assert(actives.length === active_count);
  for (const feed of actives) {
    assert(feed);
    assert(feed.active);
  }

  conn.close();
  await indexeddb_utils.remove(db_name);
}
