import {fetch_feed} from '/src/fetch.js';
import {parse_feed} from '/src/lib/parse-feed.js';
import {assert} from '/src/tests/assert.js';
import {register_test} from '/src/tests/test-registry.js';

// TODO: this needs to be run on a local resource
// TODO: this cannot accept parameters

async function feed_parser_test() {
  return true;
}

/*
window.test = async function(url_string) {
  const request_url = new URL(url_string);
  const response = await fetch_feed(request_url);
  if (!response.ok) {
    throw new Error('Failed to fetch ' + request_url.href);
  }

  const text = await response.text();
  const skip_entries = false;
  const resolve_urls = true;
  const parsed_feed = parse_feed(text, skip_entries, resolve_urls);
  console.dir(parsed_feed);
};*/

register_test(feed_parser_test);
