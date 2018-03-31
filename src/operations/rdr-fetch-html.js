import {create_error_response, fetch_with_timeout} from '/src/lib/url-loader/url-loader.js';
import {STATUS_POLICY_REFUSAL, url_is_allowed} from '/src/objects/rdr-fetch-policy.js';

const html_mime_types = ['text/html'];

export function rdr_fetch_html(url, timeout) {
  if (!url_is_allowed(url)) {
    return create_error_response(STATUS_POLICY_REFUSAL);
  }

  return fetch_with_timeout(url, {timeout: timeout, types: html_mime_types});
}
