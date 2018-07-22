// Returns a new string where sequences of two or more whitespace characters are
// replaced with a single space character (ascii 32). Throws if value is
// undefined or does not support the replace method. Assumes value is a
// DOMString, meaning that when the regex is applied, the \s pattern will also
// consider html whitespace entities.
export function condense_whitespace(value) {
  return value.replace(/\s\s+/g, ' ');
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

// Returns whether the value is an alphanumeric string. null, undefined, and the
// empty string yield true. Multilingual.
export function is_alphanumeric(value) {
  // /u flag enables \p
  // See https://github.com/tc39/proposal-regexp-unicode-property-escapes
  // note this is not supported by all browsers
  // \p{L} means match any letter in any language in either case
  // \d means [0-9]
  // ^ means any character not in the set
  // Essentially, if any non-alphanumeric character is found, return false.
  return !/[^\p{L}\d]/u.test(value);
}
