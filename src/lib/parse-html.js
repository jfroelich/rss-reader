import assert from '/src/lib/assert.js';

// Parses a string into an html document. When html is a fragment, it will be
// inserted into a new document using a default template provided by the
// browser, that includes a document element and usually a body. If not a
// fragment, then it is merged into a document with a default template.
export default function parse_html(html) {
  assert(typeof html === 'string');

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const error = doc.querySelector('parsererror');
  if (error) {
    const message = condense_whitespace(error.textContent);
    throw new Error(message);
  }

  return doc;
}

function condense_whitespace(value) {
  return value.replace(/\s\s+/g, ' ');
}