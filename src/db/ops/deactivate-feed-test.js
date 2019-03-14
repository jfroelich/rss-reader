import {assert} from '/src/assert.js';
import db_open from '/src/db/ops/db-open.js';
import create_feed from '/src/db/ops/create-feed.js';
import deactivate_feed from '/src/db/ops/deactivate-feed.js';
import get_feed from '/src/db/ops/get-feed.js';
import {Feed, is_feed} from '/src/db/types/feed.js';
import * as indexeddb_utils from '/src/indexeddb-utils/indexeddb-utils.js';

export async function deactivate_feed_test() {
  const db_name = 'db-deactivate-feed-test';
  await indexeddb_utils.remove(db_name);

  const conn = await db_open(db_name);

  const feed = new Feed();
  const url = new URL('a://b.c');
  feed.appendURL(url);
  feed.active = true;
  const feed_id = await create_feed(conn, undefined, feed);

  const messages = [];
  const channel = {};
  channel.postMessage = message => messages.push(message);
  channel.close = function() {};

  await deactivate_feed(conn, channel, feed_id, 'testing');
  channel.close();

  const stored_feed = await get_feed(conn, 'id', feed_id, false);
  assert(stored_feed);
  assert(is_feed(stored_feed));
  assert(stored_feed.active === false);
  assert(stored_feed.deactivateDate);
  const now = new Date();
  assert(stored_feed.deactivateDate <= now);

  conn.close();
  await indexeddb_utils.remove(db_name);
}
