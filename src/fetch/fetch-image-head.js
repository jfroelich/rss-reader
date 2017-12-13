import assert from "/src/assert/assert.js";
import {FetchError} from "/src/fetch/errors.js";
import fetchWithTimeout from "/src/fetch/fetch-with-timeout.js";
import isAllowedURL from "/src/fetch/fetch-policy.js";
import * as FetchUtils from "/src/fetch/utils.js";
import * as MimeUtils from "/src/mime/utils.js";
import {PermissionsError} from "/src/operations/restricted-operation.js";
import check from "/src/utils/check.js";

// TODO: this should be refactored to use fetchInternal. But I need to calculate content length.
// So fetchInternal first needs to be refactored to also calculate content length because response
// is not exposed, just wrapped response.
// TODO: if not using fetchInternal, sanity check timeoutMs

// Sends a HEAD request for the given image.
// This currently does not do any byte inspection, only mime type acceptance check, which causes
// this to respond differently than the browser sometimes
// @param url {URL}
// @returns a simple object with props size and responseURL
export default async function fetchImageHead(url, timeoutMs) {
  assert(url instanceof URL);

  // Because this function does not go through fetchInternal currently, it skips the policy check
  // that applies to most other fetch functionality. So explicitly perform the check here to comply
  // with the general warranty that all fetch functionality meets policy constraints. If and when
  // this correctly uses fetchInternal then this check becomes implicit and is no longer needs here
  check(isAllowedURL(url), PermissionsError, 'Refused to fetch url', url);


  const headers = {accept: 'image/*'};
  const options = {
    credentials: 'omit',
    method: 'head',
    headers: headers,
    mode: 'cors',
    cache: 'default',
    redirect: 'follow',
    referrer: 'no-referrer'
  };

  const response = await fetchWithTimeout(url, options, timeoutMs);
  assert(typeof response !== 'undefined');

  // TODO: this could probably be expressed in a clearer way, for now I am hackishly adding
  // support for application/octet-stream to stop favicon lookup from failing on certain websites
  const contentType = response.headers.get('Content-Type');
  check(MimeUtils.isImage(contentType) || isOtherAcceptableMimeType(contentType), FetchError,
    'Unacceptable mime type', contentType, url);

  const wrappedResponse = {};
  wrappedResponse.size = FetchUtils.getContentLength(response);
  wrappedResponse.responseURL = response.url;
  return wrappedResponse;
}

function isOtherAcceptableMimeType(contentType) {
  // To support twitch.tv, support 'application/octet-stream'
  const mimeType = MimeUtils.fromContentType(contentType);
  const types = ['application/octet-stream'];
  return types.includes(mimeType);
}
