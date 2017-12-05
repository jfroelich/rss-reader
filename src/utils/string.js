// String utilities

// Returns a new string where Unicode Cc-class characters have been removed. Throws an error if
// string is not a defined string. Adapted from these stack overflow questions:
// http://stackoverflow.com/questions/4324790
// http://stackoverflow.com/questions/21284228
// http://stackoverflow.com/questions/24229262
export function filterControls(string) {
  return string.replace(/[\x00-\x1F\x7F-\x9F]+/g, '');
}

// Wraps a call to parseInt with a base 10 parameter. General guidance is that parseInt should
// always be called with its radix parameter to avoid surprising results. For example, if no radix
// is specified, then '010' is parsed as octal instead of decimal. Rather than remember this
// everytime parseInt is used, the goal is to always use this abstraction instead, so that it is
// absurdly explicit and surprise is minimized.
//
// Second, although parseInt accepts anything, it should only be called on strings, so it is
// located in this module to emphasize that.
export function parseInt10(string) {
  const BASE_10_RADIX = 10;
  return parseInt(string, BASE_10_RADIX);
}
