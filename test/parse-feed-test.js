async function test(url) {
  'use strict';
  console.log('Starting test, fetching', url);

  let timeout_ms;
  const accept_html = true;
  const response = await fetch_feed(url, timeout_ms, accept_html);
  console.dir(response);

  // TODO: I think this code is out of date, probably no longer works?
  // Is this how text is retrieved? I think it needs an await?
  const feed_text = response.text;
  const result = parse_feed(feed_text);
  console.dir(result);
  console.log('Test completed');
}
