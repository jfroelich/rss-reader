import * as locatable from '/src/db/locatable.js';
import Feed from '/src/db/object/feed.js';
import {is_entry} from '/src/db/types.js';
import {is_feed} from '/src/db/types.js';
import assert from '/src/lib/assert.js';

export function is_feed_test() {
  const fcorrect = new Feed();
  assert(is_feed(fcorrect));
  assert(!is_entry(fcorrect));
  const nomagic = {};
  assert(!is_feed(nomagic));
}

// TODO: move this an the corresponding entry test to a shared test called
// locatable-test, because this is just exercising things redundantly
export function append_feed_url_test() {
  const feed = new Feed();
  let appended = false;
  appended = locatable.append_url(feed, new URL('a://b.c1'));
  assert(appended);
  assert(locatable.has_url(feed));

  appended = locatable.append_url(feed, new URL('a://b.c2'));
  assert(appended);
  assert(locatable.has_url(feed));
}
