import assert from "/src/utils/assert.js";
import {fetchInternal} from "/src/fetch/utils.js";
import * as MimeUtils from "/src/utils/mime-utils.js";

// TODO: remove the extendedTypes parameter, just hardcode the other types

// TODO: i think this is the wrong abstraction. See the following article
// https://www.sandimetz.com/blog/2016/1/20/the-wrong-abstraction
// * I do not like how fetch options are hardcoded. This is too opinionated.

const XML_MIME_TYPES = [
  'application/rss+xml',
  'application/rdf+xml',
  'application/atom+xml',
  'application/xml',
  'text/xml'
];

const DEFAULT_ACCEPT_HEADER_VALUE = XML_MIME_TYPES.join(',');

// Fetches a feed. Returns a basic object, similar to Response, with custom properties.
// @param url {URL} request url
// @param timeoutMs {Number} optional, timeout in milliseconds, before considering the fetch a
// failure
// @param extendedTypes {Array} optional, an array of other mime types to support, each mime type
// should be a normalized canonical mime type string, like "text/html"
// @returns {Promise} a promise that resolves to a Response-like object
export default function fetchFeed(url, timeoutMs, extendedTypes) {
  assert(typeof extendedTypes === 'undefined' || Array.isArray(extendedTypes));

  const headers = {accept: DEFAULT_ACCEPT_HEADER_VALUE};
  const options = {
    headers: headers,
    timeout: timeoutMs
  };

  const acceptedMimeTypes = extendedTypes ? XML_MIME_TYPES.concat(extendedTypes) : XML_MIME_TYPES;
  return fetchInternal(url, options, acceptedMimeTypes);
}
