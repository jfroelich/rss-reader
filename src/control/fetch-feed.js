import {assert} from '/src/lib/assert.js';
import {Deadline, INDEFINITE} from '/src/lib/deadline.js';
import * as feed_parser from '/src/lib/feed-parser.js';
import {better_fetch} from '/src/lib/net.js';
import {Feed} from '/src/model/feed.js';

export async function fetch_feed(
    url, skip_entries = true, resolve_entry_urls = false,
    timeout = INDEFINITE) {
  const response = await better_fetch(url, {timeout: timeout});
  const response_text = await response.text();
  const parsed_feed =
      feed_parser.parse(response_text, skip_entries, resolve_entry_urls);

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

  // Set the last modified date based on the response
  const last_modified_string = response.headers.get('Last-Modified');
  if (last_modified_string) {
    const last_modified_date = new Date(last_modified_string);
    if (!isNaN(last_modified_date.getTime())) {
      feed.dateLastModifed = last_modified_date;
    }
  }

  feed.dateFetched = new Date();

  const output_response = {};
  output_response.feed = feed;
  output_response.entries = parsed_feed.entries;
  output_response.http_response = response;
  return output_response;
}
