import {fetch_policy} from '/src/fetch-policy.js';
import {load_url} from '/src/lib/net/load-url.js';

const html_mime_types = ['text/html'];
const feed_mime_types = [
  'application/octet-stream', 'application/rss+xml', 'application/rdf+xml',
  'application/atom+xml', 'application/xml', 'text/html', 'text/xml'
];

export function fetch_html(url, timeout) {
  const options = {timeout: timeout, types: html_mime_types};
  return load_url(url, options, fetch_policy);
}

export function fetch_feed(url, timeout) {
  const options = {timeout: timeout, types: feed_mime_types};
  return load_url(url, options, fetch_policy);
}
