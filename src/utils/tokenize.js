// Returns an array of word token strings.
// @param value {Any} should generally be a string, but this tolerates bad input
// @returns {Array} an array of token strings
export default function tokenize(value) {
  // Rather than make any assertions about the input, tolerate bad input for the sake of caller
  // convenience.
  if(typeof value !== 'string') {
    return [];
  }

  // Trim to avoid leading/trailing space leading to empty tokens
  const trimmedInput = value.trim();

  // Special case for empty string to avoid producing empty token
  if(!trimmedInput) {
    return [];
  }

  return trimmedInput.split(/\s+/g);
}
