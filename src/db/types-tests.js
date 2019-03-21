import Entry from '/src/db/entry.js';
import {is_entry} from '/src/db/types.js';
import {is_feed} from '/src/db/types.js';
import assert from '/src/lib/assert.js';

export function is_entry_test() {
  const entry = new Entry();
  assert(is_entry(entry));
  assert(!is_feed(entry));

  assert(!is_entry({}));
}

export function is_feed_test() {
  const feed = new Feed();
  assert(is_feed(feed));
  assert(!is_entry(feed));

  assert(!is_feed({}));
}
