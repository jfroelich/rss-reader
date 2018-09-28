import assert from '/src/assert/assert.js';
import * as entry_utils from '/src/db/entry-utils.js';
import * as feed_utils from '/src/db/feed-utils.js';
import * as idbmodel from '/src/db/idb-model.js';
import {create_feed} from '/src/db/op/create-feed.js';
import * as types from '/src/db/types.js';
import * as indexeddb from '/src/indexeddb/indexeddb.js';
import {register_test} from '/test/test-registry.js';

// Test that double url insert fails, it is expected to throw a
// DOMException like the following: "Unable to add key to index 'urls': at least
// one key does not satisfy the uniqueness requirements."
async function create_feed_url_constraint_test() {
  const conn = await idbmodel.open('create-feed-url-constraint-test');
  const feed1 = feed_utils.create_feed();
  feed_utils.append_feed_url(
      feed1, new URL('http://www.example.com/example.rss'));
  await create_feed(conn, undefined, feed1);

  const feed2 = feed_utils.create_feed();
  feed_utils.append_feed_url(
      feed2, new URL('http://www.example.com/example.rss'));

  let create_error;
  try {
    await create_feed(conn, undefined, feed2);
  } catch (error) {
    create_error = error;
  }
  assert(create_error instanceof DOMException);

  conn.close();
  await indexeddb.remove(conn.name);
}


register_test(create_feed_url_constraint_test);
