// TODO: this should be revised to assume that the input value is a string so as to remain
// consistent with other parse function modules like parse-html and parse-opml.

export default function parseXML(value) {
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
