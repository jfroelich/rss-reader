import {fetchInternal} from "/src/fetch/utils.js";
import * as mime from "/src/utils/mime-utils.js";

// Fetches a feed. Returns a basic object, similar to Response, with custom properties.
// @param url {String} the url to fetch
// @param timeoutMs {Number} optional, timeout in milliseconds, before considering the fetch a
// failure
// @param extendedTypes {Array} optional, an array of other mime types to support, each mime type
// should be a normalized canonical mime type string, like "text/html"
// @returns {Promise} a promise that resolves to a Response-like object
export default function fetchFeed(url, timeoutMs, extendedTypes) {
  assert(typeof extendedTypes === 'undefined' || Array.isArray(extendedTypes));

  // TODO: this should probably come from mime-utils or somewhere
  const xmlTypes = ['application/rss+xml', 'application/rdf+xml', 'application/atom+xml',
    'application/xml', 'text/xml'];

  // TODO: this should somehow be constructed from the above list rather than specified redundantly
  // I think its ok to drop the qualifier off text/html too.
  const ACCEPT_HEADER = [
    'application/rss+xml',
    'application/rdf+xml',
    'application/atom+xml',
    'application/xml;q=0.9',
    'text/xml;q=0.8'
  ].join(',');

  const headers = {Accept: ACCEPT_HEADER};
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

  // Merge the builtin types with the extended types into a new array.
  const types = extendedTypes ? xmlTypes.concat(extendedTypes) : xmlTypes;

  function acceptPredicate(response) {
    const contentType = response.headers.get('Content-Type');
    const mimeType = mime.fromContentType(contentType);
    return types.includes(mimeType);
  }

  return fetchInternal(url, options, timeoutMs, acceptPredicate);
}
