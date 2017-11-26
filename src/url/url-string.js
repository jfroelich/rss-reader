import assert from "/src/assert.js";

// Returns true if a string represents a canonical url. The string may contain leading or trailing
// whitespace.
// Returns true for javascript: and mailto: and data:.
// Returns true for https:// and http://.
// Returns false for '//' (protocol-relative).
// Returns false for local host.
// Returns false for ip addresses.
export function isCanonicalURLString(urlString) {
  assert(typeof urlString === 'string');

  // TODO: the test should require one or more characters after the colon
  return /^\s*[a-z]+:/i.test(urlString);
}

// Returns the absolute form the input url
// @param urlString {String}
// @param baseURL {URL}
// @returns {URL} the absolute url, or undefined if an error occurred
export function resolveURLString(urlString, baseURL) {
  assert(baseURL instanceof URL);

  // Allow for bad input for caller convenience
  // If the url is not a string (e.g. undefined), return undefined
  if(typeof urlString !== 'string') {
    return;
  }

  // Check if urlString is just whitespace. If just whitespace, then return undefined. This departs
  // from the behavior of the URL constructor, which tolerates an empty or whitespace string as
  // input. The url constructor in that case will create a new URL from the base url exclusively.
  // That is misleading for this purpose.

  // If the length of the string is 0 then return undefined
  if(!urlString) {
    return;
  }

  // If the trimmed length of the string is 0 then return undefined
  if(!urlString.trim()) {
    return;
  }

  let canonicalURL;
  try {
    canonicalURL = new URL(urlString, baseURL);
  } catch(error) {
    // Ignore
  }
  return canonicalURL;
}

// I am not sure these are accurate, but I want to enforce the idea, so these are like placeholder
// constraints until if and when I ever get around to looking into it more.
const URL_MIN_LENGTH_INCLUSIVE = 1;
const URL_MAX_LENGTH_EXCLUSIVE = 3000;

// Return true if the url string is between the shortest and longest url lengths that are allowed
// for what this app considers to be a valid url
function isInRange(urlString) {
  return urlString.length < URL_MAX_LENGTH_EXCLUSIVE &&
    urlString.length >= URL_MIN_LENGTH_INCLUSIVE;
}

// Only minor validation for speed. Tolerates bad input. This isn't intended to be the most
// accurate classification. Instead, it is intended to easily find bad urls and rule them out as
// invalid, even though some slip through, and not unintentionally rule out good urls.
// @param value {String}
// @returns {Boolean}
export function isValidURLString(value) {
  return typeof value === 'string' &&
    isInRange(value) &&
    !value.trim().includes(' ');
}
