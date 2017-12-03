import fetchFeed from "/src/fetch/fetch-feed.js";

// NOTE: it looks like issue #269 works for http://www.lispcast.com/feed

async function test(url) {

  let timeoutMs;

  // Support additional types in the general case
  const extendedTypes = [
    'application/octet-stream',
    'text/html'
  ];

  const response = await fetchFeed(url, timeoutMs, extendedTypes);
  console.dir(response);
  const feedXML = await response.text();
  console.dir(feedXML);
}

window.fetchFeed = test;
