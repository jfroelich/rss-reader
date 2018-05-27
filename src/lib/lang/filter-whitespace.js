// Return a new string where whitespace has been stripped.
// Note that string is a DOMString. This means that implicitly that the regex
// \s pattern also matches whitespace entities like &nbsp;
// Throws if the input value is undefined or does not support the replace
// function (e.g. is not a string)
export function filter_whitespace(value) {
  return value.replace(/\s+/g, '');
}
