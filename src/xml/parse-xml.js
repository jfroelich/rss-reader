// XML parsing module

import assert from "/src/utils/assert.js";
import {ParseError} from "/src/utils/errors.js";
import * as mime from "/src/mime-utils.js";
import {condenseWhitespace} from "/src/utils/string.js";

export default function parseXML(xml) {
  assert(typeof xml === 'string');

  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, mime.MIME_TYPE_XML);
  assert(doc instanceof Document);

  // This cannot tell the difference between documents where the parser introduced a new element
  // and documents containing the element in the input. In the interest of safety, this always
  // fails.
  const errorElement = doc.querySelector('parsererror');
  if(errorElement) {
    let errorMessage = errorElement.textContent;
    errorMessage = condenseWhitespace(errorMessage);
    throw new ParseError(errorMessage);
  }

  return doc;
}
