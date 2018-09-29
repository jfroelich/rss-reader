import assert from '/src/assert/assert.js';
import * as feed_utils from '/src/db/feed-utils.js';
import * as idbmodel from '/src/db/idb-model.js';
import {create_feeds} from '/src/db/op/create-feeds.js';
import * as types from '/src/db/types.js';
import * as indexeddb from '/src/indexeddb/indexeddb.js';
import {register_test} from '/src/test/test-registry.js';

async function create_feeds_test() {
  const conn = await idbmodel.open('create-feeds-test');

  const num_feeds = 3;
  const feeds = [];
  for (let i = 0; i < num_feeds; i++) {
    const feed = feed_utils.create_feed();
    feed_utils.append_feed_url(feed, new URL('a://b.c' + i));
    feeds.push(feed);
  }

  const ids = await create_feeds(conn, undefined, feeds);
  assert(ids.length === num_feeds, '' + ids);

  const stored_feeds = await idbmodel.get_feeds(conn, 'all');
  assert(stored_feeds.length === num_feeds);

  // Exercise the id check
  const get_proms = ids.map(id => idbmodel.get_feed(conn, 'id', id));
  const feeds_by_id = await Promise.all(get_proms);
  for (const feed of feeds_by_id) {
    assert(types.is_feed(feed));
    assert(feed_utils.is_valid_feed_id(feed.id));
  }

  conn.close();
  await indexeddb.remove(conn.name);
}

register_test(create_feeds_test);
