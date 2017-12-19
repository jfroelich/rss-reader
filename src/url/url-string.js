import assert from "/src/assert/assert.js";

// Returns true if a string represents a canonical url. The string may contain leading or trailing
// whitespace.
// Returns true for javascript: and mailto: and data: and tel:
// Returns true for https:// and http://.
// Returns false for '//' (protocol-relative).
// Returns false for local host.
// Returns false for ipv4/6 addresses.
export function isCanonicalURLString(urlString) {
  assert(typeof urlString === 'string');
  // The string must have at least one character after the colon
  // The string may have intermediate spaces (e.g. `javascript: void(0);`)
  //return /^\s*[a-zA-Z\-]+:.+/.test(urlString);

  try {
    new URL(urlString);
    return true;
  } catch(error) {
    return false;
  }
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
