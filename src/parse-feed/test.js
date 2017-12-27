import {parseFeed} from "/src/parse-feed/parse-feed.js";
import * as FetchUtils from "/src/utils/fetch-utils.js";
import decodeEntities from "/src/utils/html/decode-entities.js";

// Test parseFeed module. At the moment this just exposes a helper function to console
// TODO: write specific tests that test various assertions, e.g. preconditions, postconditions

async function test(url) {
  let timeoutMs;
  const requestURL = new URL(url);
  const response = await FetchUtils.fetchFeed(requestURL, timeoutMs);
  const feedXML = await response.text();
  const result = parseFeed(feedXML);
  console.dir(result);
}

// Expose to console
window.test = test;
window.decodeEntities = decodeEntities;
