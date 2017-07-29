// See license.md

'use strict';

async function test(url) {
  console.log('Starting test, fetching', url);

  let timeoutMillis;
  const acceptHTML = true;
  const response = await fetchFeed(url, timeoutMillis, acceptHTML);
  const feedText = response.text;

  const result = parseFeed(feedText);
  const feed = result.feed;
  const entries = result.entries;
  console.dir(feed);
  console.dir(entries);
  console.log('Test completed');
}
