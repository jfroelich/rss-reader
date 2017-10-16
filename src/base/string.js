// string lib

'use strict';

// Depedencies:
// none

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
  // Tolerate bad input
  if(typeof string !== 'string')
    return [];

  // TODO: use more precise nlp, consider other word boundary characters

  const words = string.split(/\s+/g);

  // NOTE: split yields some empty strings sometimes, but I want the output
  // array to consist of only actual words, so I need to filter out the empty
  // strings.

  // TODO: is there a way to define the regex so that split never yields
  // empties? I believe I solved this in a very old version of the boilerplate
  // code that used to do word count before I switched it to character count.

  // TODO: this is pretty heavyweight and I am not sure it is optimized by the
  // interpreter
  const non_empty_words = words.filter((w) => w);
  return non_empty_words;
}
