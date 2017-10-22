'use strict';

// Returns a new string object where sequences of whitespace characters in the
// input string are replaced with a single space character.
// @param {String} an input string
// @throws {Error} if input is not a string
// @returns {String} a condensed string
function string_condense_whitespace(string) {
  return string.replace(/\s{2,}/g, ' ');
}

function string_remove_whitespace(string) {
  return string.replace(/\s+/g, '');
}

// Returns a new string where Unicode Cc-class characters have been removed.
// Throws an error if string is not a defined string.
// Adapted from these stack overflow questions:
// http://stackoverflow.com/questions/4324790
// http://stackoverflow.com/questions/21284228
// http://stackoverflow.com/questions/24229262
function string_filter_control_chars(string) {
  return string.replace(/[\x00-\x1F\x7F-\x9F]+/g, '');
}

// Returns an array of word token strings.
// @param string {String}
// @returns {Array} an array of tokens
function string_tokenize(string) {
  // Rather than make any assertions about the input, tolerate bad input for
  // the sake of caller convenience.
  if(typeof string !== 'string') {
    return [];
  }

  // Trim to avoid leading/trailing space leading to empty tokens
  const trimmed_input = string.trim();

  // Special case for empty string to avoid producing empty token
  if(!trimmed_input) {
    return [];
  }

  return trimmed_input.split(/\s+/g);
}
