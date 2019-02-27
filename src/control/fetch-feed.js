import * as channeled_model from '/src/model/channeled-model.js';
import {assert} from '/src/lib/assert.js';
import {Deadline} from '/src/lib/deadline.js';
import * as feed_parser from '/src/lib/feed-parser.js';
import {better_fetch} from '/src/lib/net.js';

export async function fetch_feed(url, options) {
  const feed_mime_types = [
    'application/octet-stream', 'application/rss+xml', 'application/rdf+xml',
    'application/atom+xml', 'application/xml', 'text/html', 'text/xml'
  ];

  const opts = {timeout: options.timeout, types: feed_mime_types};
  const response = await better_fetch(url, opts);
  const res_text = await response.text();

  const skip_entries = 'skip_entries' in options ? options.skip_entries : true;
  const resolve_entry_urls =
      'resolve_entry_urls' in options ? options.resolve_entry_urls : false;

  const parsed_feed =
      feed_parser.parse(res_text, skip_entries, resolve_entry_urls);

  // Convert the feed from the parse format to the storage format
  const feed = new channeled_model.Feed();
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

  // TODO: if feed is now type Feed intead of a generic object as in the prior
  // implementation, then we can just call feed.appendURL here?

  channeled_model.Feed.prototype.appendURL.call(feed, url);
  channeled_model.Feed.prototype.appendURL.call(feed, new URL(response.url));

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
