import {fetchInternal} from "/src/fetch/utils.js";
import * as mime from "/src/utils/mime-utils.js";

// TODO: issue #269 and the feed http://www.lispcast.com/feed

// Fetches a feed. Returns a basic object, similar to Response, with custom properties.
// @param url {String} the url to fetch
// @param timeoutMs {Number} optional, timeout in milliseconds, before considering the fetch a
// failure
// @param extendedTypes {Array} optional, an array of other mime types to support
// @returns {Promise} a promise that resolves to a Response-like object
export default function fetchFeed(url, timeoutMs, extendedTypes) {
  if(typeof extendedTypes === 'undefined') {
    extendedTypes = [];
  }

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

  // TODO: this should probably come from mie or some joined thing. Also the builder should
  // also build from this rather than duplicate the list.
  const xmlTypes = ['application/rss+xml', 'application/rdf+xml', 'application/atom+xml',
    'application/xml', 'text/xml'];

  // Merge the builtin types with the extended types into a new array.
  const types = xmlTypes.concat(extendedTypes);

  function acceptPredicate(response) {
    const contentType = response.headers.get('Content-Type');
    const mimeType = mime.fromContentType(contentType);
    return types.includes(mimeType);
  }

  return fetchInternal(url, options, timeoutMs, acceptPredicate);
}
