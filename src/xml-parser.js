// xml-parsing module

import {assert} from "/src/assert.js";
import {ParserError} from "/src/errors.js";
import {mime} from "/src/mime.js";

export function parseXML(xml) {
  assert(typeof xml === 'string');
  const parser = new DOMParser();

  const doc = parser.parseFromString(xml, mime.XML);
  assert(doc instanceof Document);

  // This cannot tell the difference between documents where the parser
  // introduced a new element and documents containing the element in the
  // input. In the interest of safety, this always fails.
  const errorElement = doc.querySelector('parsererror');
  if(errorElement) {
    let errorMessage = errorElement.textContent;

    // Make the error output a bit prettier for the log
    errorMessage = errorMessage.replace(/\s+/g, ' ');

    throw new ParserError(errorMessage);
  }

  return doc;
}
