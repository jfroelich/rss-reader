import {tfetch} from '/src/url-loader/url-loader.js';

export function rdr_fetch_html(url, timeout) {
  const html_mime_types = ['text/html'];
  return tfetch(url, {timeout: timeout, types: html_mime_types});
}
