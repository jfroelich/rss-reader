// Returns a new string where sequences of two or more whitespace characters are
// replaced with a single space character (ascii 32).
//
// Throws if value is undefined or does not support the replace method.
// Assumes value is a DOMString, meaning that when the regex is applied, the
// \s pattern will match html entities like &nbsp;.
export function condense_whitespace(value) {
  return value.replace(/\s{2,}/g, ' ');
}

// Returns a new string where Unicode Cc-class characters have been removed.
//
// Throws an error if string is not a defined string.
//
// Adapted from these stack overflow questions:
//
// http://stackoverflow.com/questions/4324790
// http://stackoverflow.com/questions/21284228
// http://stackoverflow.com/questions/24229262
export function filter_control_characters(value) {
  return value.replace(/[\x00-\x1F\x7F-\x9F]+/g, '');
}

// If the input is a string then this returns a new string that is a copy of the
// input less certain 'unprintable' characters. A character is unprintable if
// its character code falls within the range of [0..31] except for tab, new
// line, carriage return and form feed. In the case of bad input the input
// itself is returned. To test if characters were replaced, check if the output
// string length is less than the input string length.
export function filter_unprintable_characters(value) {
  // \t \u0009 9, \n \u000a 10, \f \u000c 12, \r \u000d 13
  // The regex matches 0-8, 11, and 14-31
  // I assume v8 will hoist regex if this is hot, so I am defining the constant
  // within the function
  // I assume v8 handles + and /g redundancy intelligently

  // The length check is done because given that replace will be a no-op when
  // the length is 0 it is faster to perform the length check than it is to call
  // replace. I do not know the distribution of inputs but I expect that empty
  // strings are not rare.

  const pattern = /[\u0000-\u0008\u000b\u000e-\u001F]+/g;
  return typeof value === 'string' && value.length ?
      value.replace(pattern, '') :
      value;
}

// Return a new string where whitespace has been stripped.
// Note that string is a DOMString. This means that implicitly that the regex
// \s pattern also matches whitespace entities like &nbsp;
// Throws if the input value is undefined or does not support the replace
// function (e.g. is not a string)
export function filter_whitespace(value) {
  return value.replace(/\s+/g, '');
}

// is_alphanumeric returns whether the value is an alphanumeric string. Counter
// intuitively, this works by testing for the presence of any non-alphanumeric
// character. The empty string is true, null/undefined are true.
//
// Notes:
// * Does not throw when the value is not a string. This is for caller
// convenience
// * Behavior when calling on strings containing non-English characters is
// undefined
//
// References:
// * https://stackoverflow.com/questions/4434076
// * https://stackoverflow.com/questions/336210
export function is_alphanumeric(value) {
  return /^[a-zA-Z0-9]*$/.test(value);
}
