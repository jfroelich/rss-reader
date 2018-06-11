import {fetch_policy} from '/src/fetch-policy.js';
import {fetch2} from '/src/lib/net/fetch2.js';

// TODO: this is no longer correct. fetch2 now throws errors, and this returns
// a promise that swallows them, all callers of this need to do more careful
// error handling

export function fetch_html(url, timeout) {
  const html_mime_types = ['text/html'];
  const options = {timeout: timeout, types: html_mime_types};
  return fetch2(url, options, fetch_policy);
}
