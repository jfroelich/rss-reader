import {is_entry} from '/src/db/types/entry.js';
import {Feed, is_feed} from '/src/db/types/feed.js';

export async function is_feed_test() {
  const fcorrect = new Feed();
  assert(is_feed(fcorrect));
  assert(!is_entry(fcorrect));
  const nomagic = {};
  assert(!is_feed(nomagic));
}

export async function append_feed_url_test() {
  const feed = new Feed();
  assert(!feed.hasURL());  // precondition
  feed.appendURL(new URL('a://b.c1'));
  assert(feed.hasURL());  // expect change
  const url2 = new URL('a://b.c2');
  feed.appendURL(url2);
  assert(feed.urls.length === 2);  // expect increment
  feed.appendURL(url2);
  assert(feed.urls.length === 2);  // expect no change
  assert(is_feed(feed));           // modifications preserved type
}
