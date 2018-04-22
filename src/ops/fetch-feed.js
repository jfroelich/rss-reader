import * as url_loader from '/src/lib/url-loader.js';
import {fetch_policy} from '/src/objects/fetch-policy.js';

const feed_mime_types = [
  'application/octet-stream', 'application/rss+xml', 'application/rdf+xml',
  'application/atom+xml', 'application/xml', 'text/html', 'text/xml'
];

export function fetch_feed(url, timeout) {
  const options = {timeout: timeout, types: feed_mime_types};
  return url_loader.load(url, options, fetch_policy);
}
