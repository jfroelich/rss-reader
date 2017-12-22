import assert from "/src/assert/assert.js";
import * as StringUtils from "/src/utils/string-utils.js";

// When html is a fragment, it will be inserted into a new document using a default template
// provided by the browser, that includes a document element and usually a body. If not a fragment,
// then it is merged into a document with a default template.
export default function parseHTML(htmlString) {
  assert(typeof htmlString === 'string');
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  assert(doc instanceof Document);
  const errorElement = doc.querySelector('parsererror');
  if(errorElement) {
    const message = StringUtils.condenseWhitespace(errorElement.textContent);
    throw new HTMLParseError(message);
  }
  return doc;
}

export class HTMLParseError extends Error {
  constructor(message) {
    super(message || 'HTML parse error');
  }
}
