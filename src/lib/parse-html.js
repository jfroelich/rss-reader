import assert from '/src/lib/assert.js';

// Parses a string into an html document. When html is a fragment, it will be inserted into a new
// document using a default template provided by the browser, that includes a document element and
// usually a body. If not a fragment, then it is merged into a document with a default template.
export default function parseHTML(htmlString) {
  assert(typeof htmlString === 'string');

  const parser = new DOMParser();
  const document = parser.parseFromString(htmlString, 'text/html');

  const parserErrorElement = document.querySelector('parsererror');
  if (parserErrorElement) {
    const message = condenseWhitespace(parserErrorElement.textContent);
    throw new HTMLParseError(message);
  }

  return document;
}

function condenseWhitespace(value) {
  return value.replace(/\s\s+/g, ' ');
}

export class HTMLParseError extends Error {
  constructor(message = 'HTML parse error') {
    super(message);
  }
}
