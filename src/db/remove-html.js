import assert from '/src/assert.js';

// TODO: instead of handling the html parsing error here, this should throw
// and shift the burden of handling that case to the caller. That generates more
// caller boilerplate but increases the flexibility by not hardcoding the
// behavior within this function.

// Return a new string consisting of the input string less any html tags.
// Certain html entities such as &#32; are decoded within the output because
// this function internally parses the html into a document object and then
// serializes it back to a string, and this deserialization/serialization
// sequence is lossy. In addition, when the input is a full document, text
// located outside the body element is not included, because this only examines
// text within the body.
//
// If a parsing error is encountered this returns a default string containing an
// error message about how the string is unsafe html.
export default function remove_html(html) {
  assert(typeof html === 'string');

  const parser = new DOMParser();
  const document = parser.parseFromString(html, 'text/html');

  if (document.querySelector('parsererror')) {
    return 'Unsafe html';
  }

  return document.documentElement.textContent;
}
