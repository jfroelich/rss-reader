import {fetch_feed} from '/src/common/fetch-utils.js';
import feed_parse from '/src/common/parse-feed.js';

// TODO: write specific tests that test various assertions, e.g. preconditions,
// postconditions

window.test = async function(urlString) {
  const response = await fetch_feed(new URL(urlString));
  const responseText = await response.text();
  console.dir(feed_parse(responseText));
};
