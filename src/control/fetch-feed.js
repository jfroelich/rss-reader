import {assert} from '/src/lib/assert.js';
import {Deadline, INDEFINITE} from '/src/lib/deadline.js';
import * as feed_parser from '/src/lib/feed-parser.js';
import {better_fetch} from '/src/lib/net.js';
import {Feed} from '/src/model/feed.js';

export async function fetch_feed(url, timeout = INDEFINITE) {
  const response = await better_fetch(url, {timeout: timeout});
  const response_text = await response.text();
  const parsed_feed = feed_parser.parse_from_string(response_text);

  // Convert the feed from the parse format to the storage format
  const feed = new Feed();
  feed.type = parsed_feed.type;

  if (parsed_feed.link) {
    try {
      const link_url = new URL(parsed_feed.link);
      feed.link = link_url.href;
    } catch (error) {
      // Ignore
    }
  }

  feed.title = parsed_feed.title;
  feed.description = parsed_feed.description;
  feed.datePublished = parsed_feed.date_published || new Date();
  feed.appendURL(url);
  feed.appendURL(new URL(response.url));

  feed.dateFetched = new Date();

  // Convert parsed entries into model entries
  for (const entry of parsed_feed.entries) {
    entry.datePublished = entry.date_published;
    delete entry.date_published;
  }

  const output_response = {};
  output_response.feed = feed;
  output_response.entries = parsed_feed.entries;
  output_response.http_response = response;
  return output_response;
}
