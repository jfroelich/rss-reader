import feed_parse from '/src/common/feed-parse.js';
import {fetch_feed} from '/src/common/fetch-utils.js';

// TODO: write specific tests that test various assertions, e.g. preconditions,
// postconditions, and make it automatic

window.test = async function(url_string) {
  const response = await fetch_feed(new URL(url_string));
  const response_text = await response.text();
  const skip_entries_flag = false;
  const parsed_feed = feed_parse(response_text, skip_entries_flag);
  console.dir(parsed_feed);
};
