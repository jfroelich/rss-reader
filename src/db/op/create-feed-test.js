import assert from '/src/assert/assert.js';
import * as feed_utils from '/src/db/feed-utils.js';
import * as idbmodel from '/src/db/idb-model.js';
import {create_feed} from '/src/db/op/create-feed.js';
import * as types from '/src/db/types.js';
import * as indexeddb from '/src/indexeddb/indexeddb.js';
import {register_test} from '/test/test-registry.js';

async function create_feed_test() {
  const feed = feed_utils.create_feed();
  const feed_url = new URL('http://www.example.com/example.rss');
  feed_utils.append_feed_url(feed, feed_url);
  const conn = await idbmodel.open('create-feed-test');
  const stored_feed_id = await create_feed(conn, undefined, feed);
  assert(feed_utils.is_valid_feed_id(stored_feed_id));
  let stored_feed = await idbmodel.get_feed(conn, 'url', feed_url, true);
  assert(types.is_feed(stored_feed));
  stored_feed = await idbmodel.get_feed(conn, 'id', stored_feed_id, false);
  assert(types.is_feed(stored_feed));
  conn.close();
  await indexeddb.remove(conn.name);
}

register_test(create_feed_test);
