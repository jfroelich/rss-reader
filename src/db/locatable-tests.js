import * as locatable from '/src/db/locatable.js';
import assert from '/src/lib/assert.js';

export function append_entry_url_test() {
  // Append a url
  const entry = {};
  let appended = locatable.append_url(entry, new URL('a://b.c1'));
  assert(appended === true);
  assert(locatable.has_url(entry));
  assert(entry.urls.length === 1);

  // Append a second url
  const url2 = new URL('a://b.c2');
  appended = locatable.append_url(entry, url2);
  assert(appended);
  assert(locatable.has_url(entry));
  assert(entry.urls.length === 2);

  // Append a duplicate
  appended = locatable.append_url(entry, url2);
  assert(!appended);
  assert(entry.urls.length === 2);
}

export function append_feed_url_test() {
  const feed = {};
  let appended = false;
  appended = locatable.append_url(feed, new URL('a://b.c1'));
  assert(appended);
  assert(locatable.has_url(feed));

  appended = locatable.append_url(feed, new URL('a://b.c2'));
  assert(appended);
  assert(locatable.has_url(feed));
}
