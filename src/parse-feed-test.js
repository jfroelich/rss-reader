// See license.md

'use strict';

async function test(url) {
  console.log('Starting test, fetching', url);
  const response = await fetchFeed(url);
  const feedText = response.text;

  // NOTE: intentionally not using parseFetchedFeed, this only tests
  // fetching
  const result = parseFeed(feedText);
  const feed = result.feed;
  const entries = result.entries;
  console.dir(feed);
  console.dir(entries);
  console.log('Test completed');
}
