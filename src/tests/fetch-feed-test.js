import {fetch_feed} from '/src/ops/fetch-feed.js';
import {assert} from '/src/tests/assert.js';

// TODO: this should be run on a local resource
// TODO: this cannot accept parameters

export async function fetch_feed_test() {
  return true;
}

/*
async function test(url_string, timeout) {
  const request_url = new URL(url_string);
  const response = await fetch_feed(request_url, timeout);
  console.dir(response);

  if (!response.ok) {
    throw new Error('Failed to fetch ' + request_url.href);
  }

  const response_text = await response.text();
  console.dir(response_text);
}*/
