import {fetch_policy} from '/src/fetch-policy.js';
import {load_url} from '/src/lib/net/load-url.js';

// Provides utilities for fetching a resource of a particular type.
// TODO: allow text/plain for fetch_html?
// TODO: break apart into individual files again

const html_mime_types = ['text/html'];

export function fetch_html(url, timeout) {
  const options = {timeout: timeout, types: html_mime_types};
  return load_url(url, options, fetch_policy);
}

const feed_mime_types = [
  'application/octet-stream', 'application/rss+xml', 'application/rdf+xml',
  'application/atom+xml', 'application/xml', 'text/html', 'text/xml'
];

export function fetch_feed(url, timeout) {
  const options = {timeout: timeout, types: feed_mime_types};
  return load_url(url, options, fetch_policy);
}
