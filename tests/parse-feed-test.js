import * as FetchUtils from "/src/common/fetch-utils.js";
import {decodeEntities} from "/src/common/html-utils.js";
import parseFeed from "/src/common/parse-feed.js";
import * as Status from "/src/common/status.js";

// Test parseFeed module. At the moment this just exposes a helper function to console
// TODO: write specific tests that test various assertions, e.g. preconditions, postconditions

async function test(url) {
  let timeoutMs, status, response, message;
  const requestURL = new URL(url);
  [status, response] = await FetchUtils.fetchFeed(requestURL, timeoutMs);
  if(status !== Status.OK) {
    console.warn('Fetch error', status);
    return;
  }

  const feedXML = await response.text();
  const feed = parseFeed(feedXML);
  console.dir(feed);
}

// Expose to console
window.test = test;
window.decodeEntities = decodeEntities;
