import assert from '/lib/assert.js';

// Return a new string consisting of the input string less any html tags.
// Certain html entities such as &#32; are decoded within the output because
// this function internally parses the html into a document object and then
// serializes it back to a string, and this deserialization/serialization
// sequence is lossy. In addition, when the input is a full document, text
// located outside the body element is not included, because this only examines
// text within the body.
//
// Throws a RemoveHTMLError when the input html is malformed (and therefore
// unsafe to use).
export default function remove_html(html) {
  assert(typeof html === 'string');

  const parser = new DOMParser();
  const document = parser.parseFromString(html, 'text/html');

  if (document.querySelector('parsererror')) {
    throw new RemoveHTMLError();
  }

  return document.documentElement.textContent;
}

export class RemoveHTMLError extends Error {
  constructor(message = 'Unsafe HTML') {
    super(message);
  }
}
