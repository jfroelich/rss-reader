import assert from "/src/utils/assert.js";
import {fetchInternal} from "/src/fetch/utils.js";
import * as MimeUtils from "/src/utils/mime-utils.js";

const FEED_MIME_TYPES = [
  'application/octet-stream',
  'application/rss+xml',
  'application/rdf+xml',
  'application/atom+xml',
  'application/xml',
  'text/html',
  'text/xml'
];

// Fetches a feed. Returns a basic object, similar to Response, with custom properties.
// @param url {URL} request url
// @param timeoutMs {Number} optional, timeout in milliseconds, before considering the fetch a
// failure
// @returns {Promise} a promise that resolves to a Response-like object
export default function fetchFeed(url, timeoutMs) {
  const options = {
    timeout: timeoutMs
  };

  return fetchInternal(url, options, FEED_MIME_TYPES);
}
