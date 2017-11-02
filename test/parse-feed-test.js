async function test(url) {
  'use strict';
  console.log('Starting test, fetching', url);

  let timeoutMs;
  const acceptHTML = true;
  const response = await fetchFeed(url, timeoutMs, acceptHTML);
  console.dir(response);

  // TODO: I think this code is out of date, probably no longer works?
  // Is this how text is retrieved? I think it needs an await?
  const feed_text = response.text;
  const result = feedParseFromString(feed_text);
  console.dir(result);
  console.log('Test completed');
}
