import {STATUS_POLICY_REFUSAL, url_is_allowed} from '/src/objects/rdr-fetch-policy.js';
import {create_error_response, tfetch} from '/src/url-loader/url-loader.js';

const feed_mime_types = [
  'application/octet-stream', 'application/rss+xml', 'application/rdf+xml',
  'application/atom+xml', 'application/xml', 'text/html', 'text/xml'
];

export function rdr_fetch_feed(url, timeout) {
  if (!url_is_allowed(url)) {
    return create_error_response(STATUS_POLICY_REFUSAL);
  }

  return tfetch(url, {timeout: timeout, types: feed_mime_types});
}
