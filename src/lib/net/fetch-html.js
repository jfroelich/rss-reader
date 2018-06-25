import {is_allowed_request} from '/src/lib/net/fetch-policy.js';
import {fetch2} from '/src/lib/net/fetch2.js';

export function fetch_html(url, timeout) {
  const html_mime_types = ['text/html'];
  const options = {timeout: timeout, types: html_mime_types};
  return fetch2(url, options, is_allowed_request);
}
