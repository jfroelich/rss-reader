'use strict';

// import base/assert.js
// import base/errors.js

// Ensure the document has a body element
function ensureBodyFilter(doc) {
  assert(doc instanceof Document);

  // If body is present then noop
  if(doc.body) {
    return;
  }

  const errorMessage = 'This document has no content.';
  const errorNode = doc.createTextNode(errorMessage);
  const bodyElement = doc.createElement('body');
  bodyElement.appendChild(errorNode);
  doc.documentElement.appendChild(bodyElement);
  return RDR_OK;
}
