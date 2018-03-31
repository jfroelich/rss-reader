import {tfetch} from '/src/url-loader/url-loader.js';

const feed_mime_types = [
  'application/octet-stream', 'application/rss+xml', 'application/rdf+xml',
  'application/atom+xml', 'application/xml', 'text/html', 'text/xml'
];

export function rdr_fetch_feed(url, timeout) {
  return tfetch(url, {timeout: timeout, types: feed_mime_types});
}
