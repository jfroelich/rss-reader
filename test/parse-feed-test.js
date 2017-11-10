'use strict';

async function test(url) {
  'use strict';
  let timeoutMs;
  const acceptHTML = true;
  const response = await fetchFeed(url, timeoutMs, acceptHTML);
  console.dir(response);
  const feedXML = await response.text();

  const parser = new FeedParser();
  const result = parser.parseFromString(feedXML);
  console.dir(result);
}
