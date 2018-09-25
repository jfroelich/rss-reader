import assert from '/src/assert/assert.js';
import * as entry_utils from '/src/db/entry-utils.js';
import * as feed_utils from '/src/db/feed-utils.js';
import {register_test} from '/test/test-registry.js';

export async function is_entry_test() {
  const correct = entry_utils.create_entry();
  assert(entry_utils.is_entry(correct));
  assert(!feed_utils.is_feed(correct));

  const nomagic = {};
  assert(!entry_utils.is_entry(nomagic));
}

export async function append_entry_url_test() {
  const entry = entry_utils.create_entry();

  // Check our precondition
  assert(entry.urls === undefined || entry.urls.length === 0);

  // Appending the first url should lazily init urls list and increment the
  // urls count
  entry_utils.append_entry_url(entry, new URL('a://b.c1'));
  assert(entry.urls);
  assert(entry.urls.length === 1);

  // Appending a distinct url should increase url count
  const url2 = new URL('a://b.c2');
  let appended = entry_utils.append_entry_url(entry, url2);
  assert(entry.urls.length === 2);
  assert(appended === true);

  // Reset, this guards against strange things like append_entry_url failing
  // to return
  appended = false;

  // Try to append a duplicate
  appended = entry_utils.append_entry_url(entry, url2);
  // Appending a duplicate url should not increase url count
  assert(entry.urls.length === 2);
  // The append should return false to indicate no append
  assert(appended === false);

  // After any number of appends, entry should still be an entry
  assert(entry_utils.is_entry(entry));
}

register_test(is_entry_test);
register_test(append_entry_url_test);
