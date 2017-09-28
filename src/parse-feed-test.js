async function test(url) {
  'use strict';
  console.log('Starting test, fetching', url);

  let timeout_ms;
  const accept_html = true;
  const response = await fetch_feed(url, timeout_ms, accept_html);
  const feed_text = response.text;

  const result = parse_feed(feed_text);
  const feed = result.feed;
  const entries = result.entries;
  console.dir(feed);
  console.dir(entries);
  console.log('Test completed');
}
