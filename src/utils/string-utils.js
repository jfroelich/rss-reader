
// TODO: now that this is the only function, just inline this everywhere. This is too simple to
// be a module. It may even be too simple to be a function in that it is not sufficiently
// abstracting.

// Returns a new string object where sequences of whitespace characters in the input string are
// replaced with a single space character.
//
// @param {String} an input string
// @throws {Error} if input is not an object with a replace method
// @returns {String} a condensed string
export function condenseWhitespace(string) {
  return string.replace(/\s{2,}/g, ' ');
}
