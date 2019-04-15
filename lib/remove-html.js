import parseHTML from '/lib/parse-html.js';

// Return a new string consisting of the input string less any html tags.
// Certain html entities such as &#32; are decoded within the output because
// this function internally parses the html into a document object and then
// serializes it back to a string, and this deserialization/serialization
// sequence is lossy. In addition, when the input is a full document, text
// located outside the body element is not included, because this only examines
// text within the body.
//
// Throws an error when the input is not a string.
// Throws an error when the input html is malformed (and therefore unsafe to use).
export default function removeHTML(htmlString) {
  const document = parseHTML(htmlString);
  return document.documentElement.textContent;
}
