import fetchFeed from "/src/fetch/fetch-feed.js";
import {parseFeed} from "/src/parse-feed/parse-feed.js";

// Test parseFeed module. At the moment this just exposes a testing function to the console that
// executes the fetchFeed function.
// TODO: write specific tests that test various assertions, e.g. preconditions, postconditions

async function test(url) {
  'use strict';

  // In console-driven test mode, leave out timeout
  let timeoutMs;

  // Support additional types in the general case
  let extendedTypes = [
    'text/html',
    'application/octet-stream'
  ];

  const response = await fetchFeed(url, timeoutMs, extendedTypes);
  console.dir(response);

  const feedXML = await response.text();
  const result = parseFeed(feedXML);
  console.dir(result);
}

window.test = test;
