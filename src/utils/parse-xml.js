import assert from "/src/utils/assert.js";
import {condenseWhitespace} from "/src/utils/string-utils.js";

// TODO: profiling shows this is one of the slowest functions in the entire app. Maybe a tokenizer
// in js would be faster?

// parseXML either produces an XMLDocument {child of Document} or throws an error.
// If the input xml string is not a string, then an unchecked assertion error is thrown.
// If there is a syntax error in the input xml string, then a checked parse error is thrown.
// Partial xml is converted into a full xml document.
export default function parseXML(xmlString) {
  // Unlike DOMParser, treat bad type as exception worthy.
  assert(typeof xmlString === 'string');
  const parser = new DOMParser();
  // Use an explicit content type to indicate and force xml
  const document = parser.parseFromString(xmlString, 'application/xml');
  // TODO: perhaps this is too paranoid
  assert(document instanceof Document);
  // Treat bad input as exception worthy
  const errorElement = document.querySelector('parsererror');
  if(errorElement) {
    const prettify = condenseWhitespace;
    const errorMessage = prettify(errorElement.textContent);
    throw new XMLParseError(errorMessage);
  }
  return document;
}

export class XMLParseError extends Error {
  constructor(message) {
    super(message || 'XML parse error');
  }
}
