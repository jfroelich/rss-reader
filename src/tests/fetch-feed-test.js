import {fetch_feed} from '/src/net/fetch-feed.js';
import {assert} from '/src/tests/assert.js';
import {register_test} from '/src/tests/test-registry.js';

// TODO: this should be run on a local resource
// TODO: this cannot accept parameters

async function fetch_feed_test() {
  return true;
}

register_test(fetch_feed_test);
