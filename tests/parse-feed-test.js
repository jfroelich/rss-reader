import * as FetchUtils from "/src/common/fetch-utils.js";
import {parseFeed} from "/src/common/parse-feed.js";
import {decodeEntities} from "/src/common/html-utils.js";

// Test parseFeed module. At the moment this just exposes a helper function to console
// TODO: write specific tests that test various assertions, e.g. preconditions, postconditions

async function test(url) {
  let timeoutMs;
  const requestURL = new URL(url);
  const response = await FetchUtils.fetchFeed(requestURL, timeoutMs);
  const feedXML = await response.text();
  const [status, feed, message] = parseFeed(feedXML);
  console.log(status, message);
  console.dir(feed);
}

// Expose to console
window.test = test;
window.decodeEntities = decodeEntities;
