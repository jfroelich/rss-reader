import * as feed_parser from '/src/feed-parser/feed-parser.js';
import {fetch_feed} from '/src/fetch/fetch.js';

// TODO: write specific tests that test various assertions, e.g. preconditions,
// postconditions, and make it automatic

window.test = async function(url_string) {
  const request_url = new URL(url_string);
  const response = await fetch_feed(request_url);
  if (!response.ok) {
    throw new Error('Failed to fetch ' + request_url.href);
  }

  const response_text = await response.text();
  const skip_entries_flag = false;
  const resolve_entry_urls_flag = true;
  const parsed_feed = feed_parser.parse(
      response_text, skip_entries_flag, resolve_entry_urls_flag);
  console.dir(parsed_feed);
};
