import assert from "/src/assert/assert.js";
import {NetworkError, OfflineError} from "/src/fetch/errors.js";
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

  // If we are able to detect connectivity, then check if we are offline. If we are offline then
  // fetch will fail with a TypeError. But I want to clearly differentiate between a site being
  // unreachable because we are offline from a site being unreachable because the site does not
  // exist. Also, a TypeError indicates an unchecked kind of error, like a programming error, but
  // should instead be treated as an ephemeral error.
  // If we cannot detect connectivity then defer to fetch.

  // TODO: do this next, create helper isOnline in platform.js and call it here
  // TODO: when is nav undef? This is a platform concern. So maybe this should call out to a
  // function in platform.js or whatever in that case, and stop pussyfooting around here.

  if((typeof navigator !== 'undefined') && ('onLine' in navigator)) {
    check(navigator.onLine, OfflineError, 'Unable to fetch url "%s" while offline', url);
  }

  // Serialize the request url back to a string, because fetch's first parameter must be either a
  // Request or a string
  const requestURLUSVString = url.href;

  let response;
  try {
    response = await fetch(requestURLUSVString, options);
  } catch(error) {
    const translatedError = translateError(error);
    throw translatedError;
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
