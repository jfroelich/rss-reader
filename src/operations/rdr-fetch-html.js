import * as url_loader from '/src/lib/url-loader/url-loader.js';
import {rdr_fetch_policy} from '/src/objects/rdr-fetch-policy.js';

// TODO: allow text/plain again?

const html_mime_types = ['text/html'];

export function rdr_fetch_html(url, timeout) {
  const options = {timeout: timeout, types: html_mime_types};
  return url_loader.load(url, options, rdr_fetch_policy);
}
