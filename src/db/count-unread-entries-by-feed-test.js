import assert from '/src/assert.js';
import {count_unread_entries_by_feed} from './count-unread-entries-by-feed.js';
import {create_entry} from './create-entry.js';
import {create_feed} from './create-feed.js';
import * as entry_utils from './entry-utils.js';
import * as feed_utils from './feed-utils.js';
import {open} from './open.js';
import {remove} from './remove.js';

export async function count_unread_entries_by_feed_test() {
  const db_name = 'count-unread-entries-by-feed-test';
  await remove(db_name);
  const session = await open(db_name);

  const feed = feed_utils.create_feed_object();
  const url = new URL('http://www.example.com/feed.xml');
  feed_utils.append_feed_url(feed, url);
  const feed_id = await create_feed(session, feed);

  const num_entries_created_per_type = 5;
  const create_promises = [];

  for (let i = 0; i < 2; i++) {
    const read_state =
        i === 0 ? entry_utils.ENTRY_STATE_UNREAD : entry_utils.ENTRY_STATE_READ;

    for (let j = 0; j < num_entries_created_per_type; j++) {
      const entry = entry_utils.create_entry_object();
      entry.feed = feed_id;
      entry.readState = read_state;
      const promise = create_entry(session, entry);
      create_promises.push(promise);
    }
  }
  const entry_ids = await Promise.all(create_promises);

  let unread_count = await count_unread_entries_by_feed(session, feed_id);
  assert(unread_count === num_entries_created_per_type);

  const non_existing_feed_id = 123456789;
  unread_count =
      await count_unread_entries_by_feed(session, non_existing_feed_id);
  assert(unread_count === 0);

  session.close();
  await remove(db_name);
}
