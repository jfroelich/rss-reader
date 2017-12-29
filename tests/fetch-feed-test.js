import * as FetchUtils from "/src/utils/fetch-utils.js";

async function fetchFeed(url) {
  let timeoutMs;
  const requestURL = new URL(url);
  const response = await FetchUtils.fetchFeed(requestURL, timeoutMs);
  console.dir(response);
  const feedXML = await response.text();
  console.dir(feedXML);
}

window.fetchFeed = fetchFeed;
