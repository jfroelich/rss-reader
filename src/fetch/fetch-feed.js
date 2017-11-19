// Fetch feed module

import {fetchInternal} from "/src/fetch/fetch-utils.js";
import * as mime from "/src/mime.js";

// Fetches a feed. Returns a basic object, similar to Response, with custom properties.
// @param url {String} the url to fetch
// @param timeoutMs {Number} optional, timeout in milliseconds, before considering the fetch a
// failure
// @param acceptHTML {Boolean} optional, defaults to true, on whether to accept html when validating
// the mime type of the response. This does not affect the request Accept header because servers do
// not appear to always honor Accept headers.
// @returns {Promise} a promise that resolves to a Response-like object
export default function fetchFeed(url, timeoutMs, acceptHTML) {
  if(typeof acceptHTML === 'undefined') {
    acceptHTML = true;
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

  const types = ['application/rss+xml', 'application/rdf+xml', 'application/atom+xml',
    'application/xml', 'text/xml'];
  if(acceptHTML) {
    types.push(mime.MIME_TYPE_HTML);
  }

  function acceptPredicate(response) {
    const contentType = response.headers.get('Content-Type');
    const mimeType = mime.fromContentType(contentType);
    return types.includes(mimeType);
  }

  return fetchInternal(url, options, timeoutMs, acceptPredicate);
}
