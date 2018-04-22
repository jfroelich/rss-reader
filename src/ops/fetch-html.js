import {load} from '/src/lib/url-loader.js';
import {fetch_policy} from '/src/objects/fetch-policy.js';

const html_mime_types = ['text/html'];

export function fetch_html(url, timeout) {
  return load(url, {timeout: timeout, types: html_mime_types}, fetch_policy);
}
