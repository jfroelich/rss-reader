import {fetchInternal} from "/src/fetch/utils.js";
import * as MimeUtils from "/src/utils/mime-utils.js";

// TODO: i think this is the wrong abstraction. See the following article
// https://www.sandimetz.com/blog/2016/1/20/the-wrong-abstraction
// * I do not like how fetch options are hardcoded. This is too opinionated.
// * I do not love the extendedTypes parameter although this does what I want at the moment. This is
// an example of one those parameters that changes default behavior mentioned in above article
// * I do not love how timeoutMs is separate from options, if options were to become a parameter

const XML_MIME_TYPES = [
  'application/rss+xml',
  'application/rdf+xml',
  'application/atom+xml',
  'application/xml',
  'text/xml'
];

const STANDARD_FEED_ACCEPT_HEADER_VALUE = XML_MIME_TYPES.join(',');

// Fetches a feed. Returns a basic object, similar to Response, with custom properties.
// @param url {String} the url to fetch
// @param timeoutMs {Number} optional, timeout in milliseconds, before considering the fetch a
// failure
// @param extendedTypes {Array} optional, an array of other mime types to support, each mime type
// should be a normalized canonical mime type string, like "text/html"
// @returns {Promise} a promise that resolves to a Response-like object
export default function fetchFeed(url, timeoutMs, extendedTypes) {
  assert(typeof extendedTypes === 'undefined' || Array.isArray(extendedTypes));

  const headers = {accept: STANDARD_FEED_ACCEPT_HEADER_VALUE};
  const options = {
    credentials: 'omit',
    method: 'get',
    headers: headers,
    mode: 'cors',
    cache: 'default',
    redirect: 'follow',
    referrer: 'no-referrer',
    referrerPolicy: 'no-referrer'
  };

  const acceptedMimeTypes = extendedTypes ? XML_MIME_TYPES.concat(extendedTypes) : XML_MIME_TYPES;
  return fetchInternal(url, options, timeoutMs, acceptedMimeTypes);
}
