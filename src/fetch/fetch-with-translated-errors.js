import check from "/src/utils/check.js";
import {NetworkError, OfflineError} from "/src/fetch/errors.js";

// Performs a call to fetch while changing the interpretation of any errors that occur into
// errors that behave in a way more acceptable to this app.

// TODO: clean up and consolidate the comments in this module
// TODO: think of a better file name
// TODO: change to accept a url that is a URL instead of a String, so that the new URL check is
// not explicitly done here.


// Per MDN: https://developer.mozilla.org/en-US/docs/Web/API/GlobalFetch
// A fetch() promise will reject with a TypeError when a network error is encountered, although
// this usually means permissions issue or similar. An accurate check for a successful fetch()
// would include checking that the promise resolved, then checking that the Response.ok property
// has a value of true. An HTTP status of 404 does not constitute a network error.

// In this extension, a TypeError is considered a serious error, at the level of an assertion
// error, and not an ephemeral error. Therefore, it is important to capture errors produced by
// calling fetch and translate them. In this case, treat a TypeError as a type of network error,
// which is a type of fetch error, and do not treat the error as a type of TypeError, which is a
// programming error involving using the wrong variable type.
export default async function fetchWithTranslatedErrors(url, options) {

  // TODO: should these checks be asserts? Right now this is basically using check to throw an
  // unchecked kind of error. TypeError is more specific than AssertionError and both are unchecked.
  // But maybe that specificity isn't worth the fact that this is not the intended use of check,
  // which is only to look at checked errors.

  // Explicitly check for and throw type errors in parameters passed to this function in order to
  // avoid ambiguity between (1) type errors thrown by fetch due to improper variable type and (2)
  // type errors thrown by fetch due to network errors. Coincidently this also affects a class of
  // invalid inputs to fetch where fetch implicitly converts non-string URLs to strings
  check(typeof url === 'string', TypeError, 'url must be a string', url);
  check(typeof options === 'undefined' || typeof options === 'object' || options === null,
    TypeError, 'options must be undefined or an object');

  // If we are able to detect connectivity, then check if we are offline. If we are offline then
  // fetch will fail with a TypeError. But I want to clearly differentiate between a site being
  // unreachable because we are offline from a site being unreachable because the site does not
  // exist. Also, a TypeError indicates an unchecked kind of error, like a programming error, but
  // should instead be treated as an ephemeral error.

  // If we cannot detect connectivity then defer to fetch.
  // TODO: when can we not? This is a platform concern. So maybe this should call out to a
  // function in platform.js or whatever in that case, and stop pussyfooting around here.
  if((typeof navigator !== 'undefined') && ('onLine' in navigator)) {
    check(navigator.onLine, OfflineError, 'Unable to fetch url "%s" while offline', url);
  }

  // Prevent fetch from implicitly assuming that it should use the contextual url of the script as
  // the base url when requesting a relative URI by explicitly checking if the url is relative.
  // When calling the URL constructor without a base url and with a relative url, the constructor
  // throws a TypeError with a message like "Failed to construct URL". This calls the constructor
  // without a try/catch, allowing the TypeError to bubble. Type errors are unchecked errors,
  // similar to assertions, which effectively means that calling this function with a relative url
  // is a programmer error.
  try {
    const ensureURLIsNotRelativeURL = new URL(url);
  } catch(error) {
    // In this case I am simply translating a type error into a simpler type error because I am
    // not a fan of the verbosity of the native type error message. The caller of
    // fetchWithTranslatedErrors isn't concerned with url construction or how the url is validated.
    // This could even be an assertion error, but both are unchecked, and type error is more
    // specific. Calling this function with a relative uri instead of a resolved uri effictively
    // means the caller called the function with the wrong 'type' of input.
    throw new TypeError('Invalid url ' + url);
  }

  let response;
  try {
    response = await fetch(url, options);
  } catch(error) {
    if(error instanceof TypeError) {
      // Change type error into network error
      throw new NetworkError('Failed to fetch', url);
    } else {
      // TODO: probably should not log here
      console.warn('Untranslated error', error);
      throw error;
    }
  }

  return response;
}
