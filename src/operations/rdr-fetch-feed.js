import {fetch_with_timeout} from '/src/lib/url-loader/url-loader.js';
import {url_is_allowed} from '/src/objects/rdr-fetch-policy.js';

const feed_mime_types = [
  'application/octet-stream', 'application/rss+xml', 'application/rdf+xml',
  'application/atom+xml', 'application/xml', 'text/html', 'text/xml'
];

export function rdr_fetch_feed(url, timeout) {
  return fetch_with_timeout(
      url, {timeout: timeout, types: feed_mime_types}, url_is_allowed);
}
