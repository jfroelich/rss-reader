import assert from '/src/assert.js';

import {create_feed} from './create-feed.js';
import * as feed_utils from './feed-utils.js';
import {get_feed_ids} from './get-feed-ids.js';
import {open} from './open.js';
import {remove} from './remove.js';

export async function get_feed_ids_test() {
  // Test setup
  const db_name = 'get-feed-ids-test';
  await remove(db_name);
  const session = await open(db_name);

  const n = 5;

  // Create some feeds
  const create_promises = [];
  for (let i = 0; i < n; i++) {
    const feed = feed_utils.create_feed_object();
    const url = new URL('http://www.example.com/feed' + i + '.xml');
    feed_utils.append_feed_url(feed, url);
    const promise = create_feed(session, feed);
    create_promises.push(promise);
  }
  const created_feed_ids = await Promise.all(create_promises);

  const feed_ids = await get_feed_ids(session);

  assert(feed_ids.length === created_feed_ids.length);

  for (const id of created_feed_ids) {
    assert(feed_ids.includes(id));
  }

  // Test teardown
  session.close();
  await remove(db_name);
}
