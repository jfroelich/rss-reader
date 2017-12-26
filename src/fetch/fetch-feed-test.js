import fetchFeed from "/src/fetch/fetch-feed.js";

async function test(url) {
  let timeoutMs;
  const requestURL = new URL(url);
  const response = await fetchFeed(requestURL, timeoutMs);
  console.dir(response);
  const feedXML = await response.text();
  console.dir(feedXML);
}

window.fetchFeed = test;
