'use strict';

// import base/number.js
// import base/errors.js
// import filters/filter-helpers.js

// @param maxTextLength {Number} optional, if number of non-tag characters
// within emphasis element is greater than this, then the element is filtered
function emphasisFilter(doc, maxTextLength) {
  console.assert(doc instanceof Document);

  if(typeof maxTextLength === 'undefined') {
    maxTextLength = 0;
  }

  console.assert(numberIsPositiveInteger(maxTextLength));

  // Restrict analysis to body
  if(!doc.body) {
    return;
  }

  const elements = doc.body.querySelectorAll('b, big, em, i, strong');
  for(const element of elements) {
    if(element.textContent.length > maxTextLength) {
      domUnwrap(element);
    }
  }

  return RDR_OK;
}
