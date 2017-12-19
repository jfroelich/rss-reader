// Returns an array of word token strings.
// @param value {Any} should generally be a string, but this tolerates bad input
// @returns {Array} an array of token strings
export default function tokenize(value) {
  // Tolerate bad input for convenience
  if(typeof value !== 'string') {
    return [];
  }

  // Trim to avoid leading/trailing space leading to empty tokens
  const trimmedInput = value.trim();

  // Special case for empty string to avoid producing empty token. The empty string is falsy,
  // so there is no need to explicitly check length. Furthermore, a length of 0 is falsy, and
  // length is always >= 0, so there would be no need to check if length > 0.
  if(!trimmedInput) {
    return [];
  }

  return trimmedInput.split(/\s+/g);
}
