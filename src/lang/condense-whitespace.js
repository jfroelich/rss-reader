// Returns a new string where sequences of two or more whitespace characters are
// replaced with a single space character (ascii 32).
//
// Throws if value is undefined or does not support the replace method.
// Assumes value is a DOMString, meaning that when the regex is applied, the
// \s pattern will match html entities like &nbsp;.
export function condense_whitespace(value) {
  return value.replace(/\s{2,}/g, ' ');
}
