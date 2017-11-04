'use strict';

async function test(url) {
  'use strict';
  let timeoutMs;
  const acceptHTML = true;
  const response = await fetchFeed(url, timeoutMs, acceptHTML);
  console.dir(response);
  const feedText = await response.text();
  const result = feedParseFromString(feedText);
  console.dir(result);
}
