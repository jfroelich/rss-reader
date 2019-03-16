import {assert} from '/src/assert.js';
import {Entry, is_entry} from '/src/db/types/entry.js';
import {is_feed} from '/src/db/types/feed.js';

export function is_entry_test() {
  const entry = new Entry();
  assert(is_entry(entry));
  assert(!is_feed(entry));
  assert(!is_entry({}));
}

export function append_entry_url_test() {
  const entry = new Entry();
  assert(entry.urls === undefined || entry.urls.length === 0);
  entry.appendURL(new URL('a://b.c1'));
  assert(entry.urls);
  assert(entry.urls.length === 1);
  const url2 = new URL('a://b.c2');
  let appended = entry.appendURL(url2);
  assert(entry.urls.length === 2);
  assert(appended === true);
  appended = false;
  appended = entry.appendURL(url2);
  assert(entry.urls.length === 2);
  assert(appended === false);
  assert(is_entry(entry));
}
