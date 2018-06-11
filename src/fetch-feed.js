import * as db from '/src/db.js';
import {fetch_policy} from '/src/fetch-policy.js';
import {load_url, STATUS_OFFLINE, STATUS_TIMEOUT} from '/src/lib/net/load-url.js';
import {parse_feed} from '/src/lib/parse-feed.js';

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

  // Get the response
  const options = {timeout: timeout, types: feed_mime_types};
  const response = await load_url(url, options, fetch_policy);

  // Distinguish this error response as its own exception so that callers can
  // easily differentiate by error type
  if (response.status === STATUS_OFFLINE) {
    throw new OfflineError('Failed to fetch ' + url.href);
  }

  // Distinguish this error response as its own exception so that callers can
  // easily differentiate by error type
  if (response.status === STATUS_TIMEOUT) {
    throw new TimeoutError('Timed out fetching ' + url.href)
  }

  // Catch all for other fetch errors using generic Error type
  if (!response.ok) {
    throw new Error(
        'Fetching feed ' + url.href + ' failed with status ' + response.status);
  }

  // Get the response full text. Rethrow i/o errors
  const res_text = await response.text();

  // Parse the full text into a parsed-feed object. Rethrow parse errors
  const parsed_feed = parse_feed(res_text, skip_entries, resolve_entry_urls);

  // Convert the feed from the parse format to the storage format
  const feed = db.create_feed();

  if (parsed_feed.type) {
    db.set_feed_type(feed, parsed_feed.type);
  }

  if (parsed_feed.link) {
    let link_url;
    try {
      link_url = new URL(parsed_feed.link);
    } catch (error) {
    }

    if (link_url) {
      db.set_feed_link(feed, link_url.href);
    }
  }

  if (parsed_feed.title) {
    db.set_feed_title(feed, parsed_feed.title);
  }

  if (parsed_feed.description) {
    db.set_feed_description(feed, parsed_feed.description);
  }

  if (parsed_feed.datePublished) {
    db.set_feed_date_published(feed, parsed_feed.datePublished);
  } else {
    db.set_feed_date_published(feed, new Date());
  }

  // Set the request url
  db.append_feed_url(feed, url);

  // Set the response url
  db.append_feed_url(feed, new URL(response.url));

  // Set the last modified date based on the response
  const last_modified_string = response.headers.get('Last-Modified');
  if (last_modified_string) {
    const last_modified_date = new Date(last_modified_string);
    if (!isNaN(last_modified_date.getTime())) {
      db.set_feed_date_last_modified(feed, last_modified_date);
    }
  }

  // Set the date the feed was fetched to now
  db.set_feed_date_fetched(feed, new Date());

  return feed;
}

export class OfflineError extends Error {
  constructor(message = 'Failed to fetch while offline') {
    super(message);
  }
}

export class TimeoutError extends Error {
  constructor(message = 'Failed to fetch due to timeout') {
    super(message);
  }
}
