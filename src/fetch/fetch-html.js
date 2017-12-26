import assert from "/src/utils/assert.js";
import {fetchInternal} from "/src/fetch/utils.js";
import * as MimeUtils from "/src/utils/mime-utils.js";

// Fetches the html content of the given url
// @param url {URL} request url
// @param timeoutMs {Number} optional, in milliseconds, how long to wait before considering the
// fetch to be a failure.
export default function fetchHTML(url, timeoutMs) {
  assert(url instanceof URL);

  // TODO: because I have to accept */*, specifying an Accept header is dumb

  // NOTE: accept */* to fix issue #271 and avoid 406 response code
  const acceptHeaderValue = [
    MimeUtils.MIME_TYPE_HTML,
    '*/*;q=0.9'
  ].join(',');

  const options = {
    headers: {accept: acceptHeaderValue},
    timeout: timeoutMs
  };

  const acceptedMimeTypes = [MimeUtils.MIME_TYPE_HTML];
  return fetchInternal(url, options, acceptedMimeTypes);
}
