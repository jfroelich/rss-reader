export function parse_xml(value) {
  if (typeof value !== 'string') {
    throw new TypeError('value is not a string');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(value, 'application/xml');
  const error = doc.querySelector('parsererror');
  if (error) {
    throw new ParseError(error.textContent);
  }

  return doc;
}

export class ParseError extends Error {
  constructor(message = 'Parse error') {
    super(message);
  }
}
