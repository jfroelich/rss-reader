import assert from "/src/assert/assert.js";
import {NetworkError, OfflineError} from "/src/fetch/errors.js";
import {isOnline} from "/src/platform/platform.js";
import check from "/src/utils/check.js";

// Wraps a call to fetch and changes the types of certain errors thrown. The primary problem
// solved is that my app considers a TypeError as indicative of a critical, permanent, unexpected,
// unchecked, programmer syntax error, but fetch throws TypeError errors for other reasons that
// are ephemeral, such as when a network error occurs, or when a url happens to contain credentials.
// @param url {URL} request url
// @param options {Object} optional, options variable passed directly to the fetch call
export default async function fetchWithTranslatedErrors(url, options) {
  // Implicitly, by accepting a URL parameter, this guarantees the request url is canonical.
  // This avoids an implicit behavior of fetch where the url of the calling context is used as the
  // base url when the url argument to fetch is a string containing a relative url. Allowing for a
  // relative url leads to other surprise, such as getting a TypeError because this tried to fetch
  // something with protocol 'chrome-extension:'.
  assert(url instanceof URL);

  // fetch throws a TypeError if the options object, if defined, is not an object. Prevent the later
  // code that calls fetch and catches exceptions from translating this kind of TypeError into a
  // network error. This kind of type error becomes an assertion error, which is equivalent to a
  // TypeError in that both are unchecked.
  assert(typeof options === 'undefined' || typeof options === 'object' || options === null);

  // fetch fails with a TypeError when offline. This would ordinarily later be translated to a
  // NetworkError, but I want to the caller to be able to distinguish between a site being
  // unreachable while online, and a site being unreachable while offline.
  check(isOnline(), OfflineError, 'Unable to fetch url "%s" while offline', url);

  let response;
  try {
    response = await fetch(url.href, options);
  } catch(error) {
    throw translateError(error);
  }

  // fetchWithTranslatedErrors warrants that the output object is defined
  assert(response instanceof Response);
  return response;
}

// Returns a translated error if the input error is translated, otherwise returns the input error
function translateError(error) {
  // Per MDN, a fetch() promise will reject with a TypeError when a network error is encountered,
  // or when the url contains credentials. Translate such errors into network errors.

  if(error instanceof TypeError) {
    return new NetworkError('Failed to fetch', url, 'because of a checked error', error);
  }

  // Right now I believe this never happens? fetch pretty much throws only TypeErrors when an
  // error occurs, right? I am logging for the time being to see if this ever happens
  console.warn('unknown error type thrown by fetch', error);
  return error;
}
