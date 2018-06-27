import {is_allowed_request} from '/src/lib/net/fetch-policy.js';
import {fetch2} from '/src/lib/net/fetch2.js';
import {parse_feed} from '/src/lib/parse-feed/parse-feed.js';
import * as Model from '/src/model/model.js';

// Fetches a remote feed xml file. Note that this is not a generic library, this
// applies app-specific behavior. To get generic functionality, directly
// interact with the components that compose this function.
//
// This function is a composition of the following functions:
// * Fetching the contents of the remote file
// * Parsing the contents into a generic parsed-feed object
// * Coercing the generic format into the app's stored-feed format
export async function fetch_feed(
    url, timeout, skip_entries = true, resolve_entry_urls = false) {
  const feed_mime_types = [
    'application/octet-stream', 'application/rss+xml', 'application/rdf+xml',
    'application/atom+xml', 'application/xml', 'text/html', 'text/xml'
  ];

  // Get the response, rethrow any fetch errors
  const options = {timeout: timeout, types: feed_mime_types};
  const response = await fetch2(url, options, is_allowed_request);

  // Get the response full text. Rethrow i/o errors
  const res_text = await response.text();

  // Parse the full text into a parsed-feed object. Rethrow parse errors
  const parsed_feed = parse_feed(res_text, skip_entries, resolve_entry_urls);

  // Convert the feed from the parse format to the storage format
  const feed = Model.create_feed();

  if (parsed_feed.type) {
    Model.set_feed_type(feed, parsed_feed.type);
  }

  if (parsed_feed.link) {
    let link_url;
    try {
      link_url = new URL(parsed_feed.link);
    } catch (error) {
    }

    if (link_url) {
      Model.set_feed_link(feed, link_url.href);
    }
  }

  if (parsed_feed.title) {
    Model.set_feed_title(feed, parsed_feed.title);
  }

  if (parsed_feed.description) {
    Model.set_feed_description(feed, parsed_feed.description);
  }

  if (parsed_feed.date_published) {
    Model.set_feed_date_published(feed, parsed_feed.date_published);
  } else {
    Model.set_feed_date_published(feed, new Date());
  }

  Model.append_feed_url(feed, url);
  Model.append_feed_url(feed, new URL(response.url));

  // Set the last modified date based on the response
  const last_modified_string = response.headers.get('Last-Modified');
  if (last_modified_string) {
    const last_modified_date = new Date(last_modified_string);
    if (!isNaN(last_modified_date.getTime())) {
      Model.set_feed_date_last_modified(feed, last_modified_date);
    }
  }

  // Set the date the feed was fetched to now
  Model.set_feed_date_fetched(feed, new Date());

  const output_response = {};
  output_response.feed = feed;
  output_response.entries = parsed_feed.entries;
  return output_response;
}
