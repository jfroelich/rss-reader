
import assert from "/src/assert.js";

// Allows for leading whitespace characters. Returns true for javascript: and
// mailto: and data:. Returns true for https:// and http://. Returns false for
// '//'.
// @param url {String} input url
// @returns {Boolean} true if the url is canonical, otherwise false
export function isCanonicalURLString(urlString) {
  assert(typeof urlString === 'string');
  return /^\s*[a-z]+:/i.test(urlString);
}
