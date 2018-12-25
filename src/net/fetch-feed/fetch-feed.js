import {parse_feed} from '/src/net/fetch-feed/parse-feed.js';
import * as db from '/src/db/db.js';
import {is_allowed_request} from '/src/net/fetch-policy.js';
import {fetch2} from '/src/net/fetch2.js';

export async function fetch_feed(
    url, timeout, skip_entries = true, resolve_entry_urls = false) {
  const feed_mime_types = [
    'application/octet-stream', 'application/rss+xml', 'application/rdf+xml',
    'application/atom+xml', 'application/xml', 'text/html', 'text/xml'
  ];

  const options = {timeout: timeout, types: feed_mime_types};
  const response = await fetch2(url, options, is_allowed_request);
  const res_text = await response.text();
  const parsed_feed = parse_feed(res_text, skip_entries, resolve_entry_urls);

  // Convert the feed from the parse format to the storage format
  const feed = db.create_feed_object();
  feed.type = parsed_feed.type;

  if (parsed_feed.link) {
    let link_url;
    try {
      link_url = new URL(parsed_feed.link);
    } catch (error) {
    }

    if (link_url) {
      feed.link = link_url.href;
    }
  }

  feed.title = parsed_feed.title;
  feed.description = parsed_feed.description;
  feed.datePublished = parsed_feed.date_published || new Date();

  db.append_feed_url(feed, url);
  db.append_feed_url(feed, new URL(response.url));

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
  return output_response;
}
