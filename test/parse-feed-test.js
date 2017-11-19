// Test parseFeed module

// TODO: I now have two parse feed files. Now it is ambiguous which one this test refers to. This
// is a consequence of a test folder. I think this is a valid reason for merging test files into
// the source folder. I think I should do that. Take a closer look at where other popular open
// source projects store test code.

import fetchFeed from "/src/fetch/fetch-feed.js";
import parseFeed from "/src/parse-feed.js";

async function test(url) {
  'use strict';
  let timeoutMs;
  const acceptHTML = true;
  const response = await fetchFeed(url, timeoutMs, acceptHTML);
  console.dir(response);
  const feedXML = await response.text();
  const result = parseFeed(feedXML);
  console.dir(result);
}
