import {load} from '/src/lib/url-loader.js';
import {fetch_policy} from '/src/objects/fetch-policy.js';

// TODO: maybe move to src folder?

const html_mime_types = ['text/html'];

export function fetch_html(url, timeout) {
  const options = {timeout: timeout, types: html_mime_types};
  return load(url, options, fetch_policy);
}

const feed_mime_types = [
  'application/octet-stream', 'application/rss+xml', 'application/rdf+xml',
  'application/atom+xml', 'application/xml', 'text/html', 'text/xml'
];

export function fetch_feed(url, timeout) {
  const options = {timeout: timeout, types: feed_mime_types};
  return load(url, options, fetch_policy);
}
