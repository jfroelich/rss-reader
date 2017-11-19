// HTML parsing module

import assert from "/src/utils/assert.js";
import {check, ParseError} from "/src/utils/errors.js";
import * as mime from "/src/mime-utils.js";

// When html is a fragment, it will be inserted into a new document using a default template
// provided by the browser, that includes a document element and usually a body. If not a fragment,
// then it is merged into a document with a default template.
export default function parseHTML(html) {
  assert(typeof html === 'string');
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, mime.MIME_TYPE_HTML);
  assert(doc instanceof Document);
  const errorElement = doc.querySelector('parsererror');
  // TODO: prettify the error message, strip line breaks, see what I did in xml parser and use
  // the same consistent pattern
  check(!errorElement, ParseError, errorElement ? errorElement.textContent : '');
  return doc;
}
