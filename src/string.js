// String utilities

// Returns a new string object where sequences of whitespace characters in the
// input string are replaced with a single space character.
// @param {String} an input string
// @throws {Error} if input is not a string
// @returns {String} a condensed string
export function condenseWhitespace(string) {
  return string.replace(/\s{2,}/g, ' ');
}

export function filterWhitespace(string) {
  return string.replace(/\s+/g, '');
}

// From the start of the string to its end, if one or more of the characters is not in the
// class of alphanumeric characters, then the string is not alphanumeric.
// See https://stackoverflow.com/questions/4434076
// See https://stackoverflow.com/questions/336210
// The empty string is true, null/undefined are true
// Does NOT support languages other than English
export function isAlphanumeric(string) {
  return /^[a-zA-Z0-9]*$/.test(string);
}

// Returns a new string where Unicode Cc-class characters have been removed.
// Throws an error if string is not a defined string.
// Adapted from these stack overflow questions:
// http://stackoverflow.com/questions/4324790
// http://stackoverflow.com/questions/21284228
// http://stackoverflow.com/questions/24229262
export function filterControls(string) {
  return string.replace(/[\x00-\x1F\x7F-\x9F]+/g, '');
}

// Returns an array of word token strings.
// @param string {String}
// @returns {Array} an array of tokens
export function tokenize(string) {
  // Rather than make any assertions about the input, tolerate bad input for
  // the sake of caller convenience.
  if(typeof string !== 'string') {
    return [];
  }

  // Trim to avoid leading/trailing space leading to empty tokens
  const trimmedInput = string.trim();

  // Special case for empty string to avoid producing empty token
  if(!trimmedInput) {
    return [];
  }

  return trimmedInput.split(/\s+/g);
}
