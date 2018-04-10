import * as url_loader from '/src/lib/url-loader/url-loader.js';
import {rdr_fetch_policy} from '/src/objects/rdr-fetch-policy.js';

const feed_mime_types = [
  'application/octet-stream', 'application/rss+xml', 'application/rdf+xml',
  'application/atom+xml', 'application/xml', 'text/html', 'text/xml'
];

export function rdr_fetch_feed(url, timeout) {
  const options = {timeout: timeout, types: feed_mime_types};
  return url_loader.load(url, options, rdr_fetch_policy);
}