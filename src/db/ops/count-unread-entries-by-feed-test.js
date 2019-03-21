import * as locatable from '/src/db/locatable.js';
import Entry from '/src/db/entry.js';
import Feed from '/src/db/feed.js';
import count_unread_entries_by_feed from '/src/db/ops/count-unread-entries-by-feed.js';
import create_entry from '/src/db/ops/create-entry.js';
import create_feed from '/src/db/ops/create-feed.js';
import db_open from '/src/db/ops/open.js';
import assert from '/src/lib/assert.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';

export async function count_unread_entries_by_feed_test() {
  const db_name = 'db-count-unread-entries-by-feed-test';
  await indexeddb_utils.remove(db_name);

  const conn = await db_open(db_name);

  const feed = new Feed();
  const url = new URL('http://www.example.com/feed.xml');
  locatable.append_url(feed, url);
  const feed_id = await create_feed(conn, undefined, feed);

  const num_entries_created_per_type = 5;
  const create_promises = [];

  for (let i = 0; i < 2; i++) {
    const read_state = i === 0 ? Entry.UNREAD : Entry.READ;
    for (let j = 0; j < num_entries_created_per_type; j++) {
      const entry = new Entry();
      entry.feed = feed_id;
      entry.readState = read_state;
      create_promises.push(create_entry(conn, undefined, entry));
    }
  }
  const entry_ids = await Promise.all(create_promises);

  let unread_count = await count_unread_entries_by_feed(conn, feed_id);
  assert(unread_count === num_entries_created_per_type);

  const non_existent_id = 123456789;
  unread_count = await count_unread_entries_by_feed(conn, non_existent_id);
  assert(unread_count === 0);

  conn.close();
  await indexeddb_utils.remove(db_name);
}
