import assert from "/src/assert/assert.js";
import {fetchInternal} from "/src/fetch/utils.js";
import * as MimeUtils from "/src/utils/mime-utils.js";

// Fetches the html content of the given url
// @param url {URL} request url
// @param timeoutMs {Number} optional, in milliseconds, how long to wait before considering the
// fetch to be a failure.
export default function fetchHTML(url, timeoutMs) {
  assert(url instanceof URL);

  // NOTE: accept */* to fix issue #271 and avoid 406 response code
  const acceptHeaderValue = [
    MimeUtils.MIME_TYPE_HTML,
    '*/*;q=0.9'
  ].join(',');

  const options = {
    credentials: 'omit',
    method: 'get',
    headers: {accept: acceptHeaderValue},
    mode: 'cors',
    cache: 'default',
    redirect: 'follow',
    referrer: 'no-referrer',
    referrerPolicy: 'no-referrer'
  };

  const acceptedMimeTypes = [MimeUtils.MIME_TYPE_HTML];
  return fetchInternal(url, options, timeoutMs, acceptedMimeTypes);
}
