import assert from '/src/assert/assert.js';
import * as Model from '/src/model/model.js';
import {register_test} from '/test/test-registry.js';

export async function is_feed_test() {
  // assert the typical correct path
  const fcorrect = Model.create_feed();
  assert(Model.is_feed(fcorrect));

  // assert the bad path
  assert(!Model.is_entry(fcorrect));

  // assert magic is checked
  const nomagic = {};
  assert(!Model.is_feed(nomagic));

  // Assert function-created objects are not feeds
  assert(!Model.is_feed(new function() {
    this.magic = Model.FEED_MAGIC;
  }));
}

export async function is_entry_test() {
  const correct = Model.create_entry();
  assert(Model.is_entry(correct));

  assert(!Model.is_feed(correct));

  const nomagic = {};
  assert(!Model.is_entry(nomagic));

  // Assert function-created objects are not feeds
  assert(!Model.is_entry(new function() {
    this.magic = Model.ENTRY_MAGIC;
  }));
}


export async function append_feed_url_test() {
  const feed = Model.create_feed();

  // precondition
  assert(feed.urls === undefined || feed.urls.length === 0);

  // Appending the first url should lazily init urls list and increment the
  // urls count
  Model.append_feed_url(feed, new URL('a://b.c1'));
  assert(feed.urls);
  assert(feed.urls.length === 1);

  // Appending a distinct url should increase url count
  const url2 = new URL('a://b.c2');
  Model.append_feed_url(feed, url2);
  assert(feed.urls.length === 2);

  // Appending a duplicate url should not increase url count
  Model.append_feed_url(feed, url2);
  assert(feed.urls.length === 2);

  // After appends, feed should still be a feed
  assert(Model.is_feed(feed));
}

export async function append_entry_url_test() {
  const entry = Model.create_entry();

  // Check our precondition
  assert(entry.urls === undefined || entry.urls.length === 0);

  // Appending the first url should lazily init urls list and increment the
  // urls count
  Model.append_entry_url(entry, new URL('a://b.c1'));
  assert(entry.urls);
  assert(entry.urls.length === 1);

  // Appending a distinct url should increase url count
  const url2 = new URL('a://b.c2');
  let appended = Model.append_entry_url(entry, url2);
  assert(entry.urls.length === 2);
  assert(appended === true);

  // Reset, this guards against strange things like append_entry_url failing
  // to return
  appended = false;

  // Try to append a duplicate
  appended = Model.append_entry_url(entry, url2);
  // Appending a duplicate url should not increase url count
  assert(entry.urls.length === 2);
  // The append should return false to indicate no append
  assert(appended === false);

  // After any number of appends, entry should still be an entry
  assert(Model.is_entry(entry));
}

register_test(is_feed_test);
register_test(is_entry_test);
register_test(append_feed_url_test);
register_test(append_entry_url_test);
