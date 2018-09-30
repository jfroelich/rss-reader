import assert from '/src/assert/assert.js';
import * as entry_utils from '/src/db/entry-utils.js';
import * as feed_utils from '/src/db/feed-utils.js';
import * as types from '/src/db/types.js';

export async function feed_utils_is_feed_test() {
  const fcorrect = feed_utils.create_feed_object();
  assert(types.is_feed(fcorrect));
  assert(!types.is_entry(fcorrect));

  const nomagic = {};
  assert(!types.is_feed(nomagic));
}

export async function feed_utils_append_feed_url_test() {
  const feed = feed_utils.create_feed_object();

  // precondition, in case create_feed_object changes its behavior
  assert(feed.urls === undefined || feed.urls.length === 0);

  // Appending the first url should lazily init urls list and increment the
  // urls count
  feed_utils.append_feed_url(feed, new URL('a://b.c1'));
  assert(feed.urls);
  assert(feed.urls.length === 1);

  // Appending a distinct url should increase url count
  const url2 = new URL('a://b.c2');
  feed_utils.append_feed_url(feed, url2);
  assert(feed.urls.length === 2);

  // Appending a duplicate url should not increase url count
  feed_utils.append_feed_url(feed, url2);
  assert(feed.urls.length === 2);

  // After appends, feed should still be a feed
  assert(types.is_feed(feed));
}
