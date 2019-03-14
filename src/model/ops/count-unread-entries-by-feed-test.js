import {assert} from '/src/assert.js';
import * as indexeddb_utils from '/src/indexeddb-utils/indexeddb-utils.js';
import {Model} from '/src/model/model.js';
import count_unread_entries_by_feed from '/src/model/ops/count-unread-entries-by-feed.js';
import create_feed from '/src/model/ops/create-feed.js';
import {Entry} from '/src/model/types/entry.js';
import {Feed} from '/src/model/types/feed.js';

export async function count_unread_entries_by_feed_test() {
  const db_name = 'count-unread-entries-by-feed-test';
  await indexeddb_utils.remove(db_name);

  const model = new Model();
  model.name = db_name;
  await model.open();

  const feed = new Feed();
  const url = new URL('http://www.example.com/feed.xml');
  feed.appendURL(url);
  const feed_id = await create_feed(model, feed);

  const num_entries_created_per_type = 5;
  const create_promises = [];

  for (let i = 0; i < 2; i++) {
    const read_state = i === 0 ? Entry.UNREAD : Entry.READ;
    for (let j = 0; j < num_entries_created_per_type; j++) {
      const entry = new Entry();
      entry.feed = feed_id;
      entry.readState = read_state;
      const promise = create_entry(model, entry);
      create_promises.push(promise);
    }
  }
  const entry_ids = await Promise.all(create_promises);

  let unread_count = await count_unread_entries_by_feed(model, feed_id);
  assert(unread_count === num_entries_created_per_type);

  const non_existent_id = 123456789;
  unread_count = await count_unread_entries_by_feed(model, non_existent_id);
  assert(unread_count === 0);
  model.close();
  await indexeddb_utils.remove(db_name);
}
