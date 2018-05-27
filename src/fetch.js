import {fetch_policy} from '/src/fetch-policy.js';
import {load} from '/src/lib/net/url-loader.js';

/*
# fetch
Provides utilities for fetching a resource of a particular type.

## fetch-html
todo

## fetch-feed
todo

### Todos
* allow text/plain for fetch_html?

*/

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
