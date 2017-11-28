
// A parse operation is any type of functional operation that involves parsing. Parse operations
// that encounter a problem when parsing that is related to parsing should throw a ParseError.

export class ParseError extends Error {
  constructor(message) {
    super(message || 'Parse error');
  }
}
