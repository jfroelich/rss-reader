import assert from "/src/assert.js";

// Ensures the input document has a <body> element
export default function ensureBodyFilter(doc) {
  assert(doc instanceof Document);
  if(doc.body) {
    return;
  }

  const errorMessage = 'This document has no content.';
  const errorNode = doc.createTextNode(errorMessage);
  const bodyElement = doc.createElement('body');
  bodyElement.appendChild(errorNode);
  doc.documentElement.appendChild(bodyElement);
}
