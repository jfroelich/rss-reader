
import {fetchFeed} from "/src/fetch.js";
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
