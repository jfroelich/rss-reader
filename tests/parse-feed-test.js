import {fetchFeed} from "/src/common/fetch-utils.js";
import parseFeed from "/src/common/parse-feed.js";

// TODO: write specific tests that test various assertions, e.g. preconditions, postconditions

window.test = async function(urlString) {
  const response = await fetchFeed(new URL(urlString));
  const responseText = await response.text();
  console.dir(parseFeed(responseText));
};
