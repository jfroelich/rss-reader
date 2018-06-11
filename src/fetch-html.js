import {fetch_policy} from '/src/fetch-policy.js';
import {load_url} from '/src/lib/net/load-url.js';

const html_mime_types = ['text/html'];

export function fetch_html(url, timeout) {
  const options = {timeout: timeout, types: html_mime_types};
  return load_url(url, options, fetch_policy);
}
