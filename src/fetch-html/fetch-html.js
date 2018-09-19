import {is_allowed_request} from '/src/fetch-policy/fetch-policy.js';
import {fetch2} from '/src/fetch2/fetch2.js';

export function fetch_html(url, timeout, allow_text) {
  const html_mime_types = ['text/html'];

  if (allow_text) {
    html_mime_types.push('text/plain');
  }

  const options = {timeout: timeout, types: html_mime_types};
  return fetch2(url, options, is_allowed_request);
}
