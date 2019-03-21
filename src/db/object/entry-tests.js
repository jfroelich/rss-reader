import * as locatable from '/src/db/locatable.js';
import Entry from '/src/db/object/entry.js';
import {is_entry} from '/src/db/types.js';
import {is_feed} from '/src/db/types.js';
import assert from '/src/lib/assert.js';

export function is_entry_test() {
  const entry = new Entry();
  assert(is_entry(entry));
  assert(!is_feed(entry));
  assert(!is_entry({}));
}

export function append_entry_url_test() {
  // Append a url
  const entry = new Entry();
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
