import {fetch_with_timeout} from '/src/lib/url-loader/url-loader.js';
import {url_is_allowed} from '/src/objects/rdr-fetch-policy.js';

// TODO: allow text/plain again?

const html_mime_types = ['text/html'];

export function rdr_fetch_html(url, timeout) {
  return fetch_with_timeout(
      url, {timeout: timeout, types: html_mime_types}, url_is_allowed);
}
