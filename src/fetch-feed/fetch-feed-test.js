import assert from '/src/assert/assert.js';
import {fetch_feed} from '/src/fetch-feed/fetch-feed.js';
import {register_test} from '/src/test/test-registry.js';

// TODO: this should be run on a local resource
// TODO: this cannot accept parameters

async function fetch_feed_test() {
  return true;
}

register_test(fetch_feed_test);
