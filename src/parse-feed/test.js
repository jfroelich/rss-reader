import fetchFeed from "/src/fetch/fetch-feed.js";
import decodeEntities from "/src/utils/html/decode-entities.js";
import {parseFeed} from "/src/parse-feed/parse-feed.js";

// Test parseFeed module. At the moment this just exposes a helper function to console
// TODO: write specific tests that test various assertions, e.g. preconditions, postconditions

async function test(url) {
  let timeoutMs;
  const requestURL = new URL(url);
  const response = await fetchFeed(requestURL, timeoutMs);
  const feedXML = await response.text();
  const result = parseFeed(feedXML);
  console.dir(result);
}

// Expose to console
window.test = test;
window.decodeEntities = decodeEntities;
