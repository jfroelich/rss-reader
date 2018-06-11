import {fetch_feed} from '/src/fetch-feed.js';
import {parse_feed} from '/src/lib/parse-feed.js';
import {assert} from '/src/tests/assert.js';
import {register_test} from '/src/tests/test-registry.js';

// TODO: this needs to be run on a local resource instead of fetching a remote
// one
// TODO: this cannot accept parameters

async function feed_parser_test() {
  return true;
}

register_test(feed_parser_test);
