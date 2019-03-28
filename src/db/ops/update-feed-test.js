import Feed from '/src/db/feed.js';
import * as locatable from '/src/db/locatable.js';
import create_feed from '/src/db/ops/create-feed.js';
import get_feed from '/src/db/ops/get-feed.js';
import update_feed from '/src/db/ops/update-feed.js';
import test_open from '/src/db/test-open.js';
import assert, {AssertionError} from '/src/lib/assert.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';

export async function update_feed_test() {
  const db_name = 'update-feed-test';
  await indexeddb_utils.remove(db_name);

  const conn = await test_open(db_name);

  let feed = new Feed();
  feed.title = 'first';
  const url = new URL('a://b.c');
  locatable.append_url(feed, url);

  let new_id = await create_feed(conn, feed);

  feed.id = new_id;
  feed.title = 'second';
  await update_feed(conn, feed, true);

  feed = undefined;  // paranoia
  feed = await get_feed(conn, 'id', new_id, false);
  assert(feed.title = 'second');

  feed = new Feed();
  feed.title = 'third-bad';
  locatable.append_url(feed, new URL('a://b.c.d'));
  feed.magic = 0;  // intentionally do some voodoo

  let expected_error;
  try {
    await update_feed(conn, feed, false);
  } catch (error) {
    expected_error = error;
  }

  // Updating a feed with bad magic should trigger an assertion error
  assert(expected_error instanceof AssertionError);

  conn.close();
  await indexeddb_utils.remove(db_name);
}
