'use strict';

// import filters/filter-helpers.js
// import rbl.js

// @param maxTextLength {Number} optional, if number of non-tag characters
// within emphasis element is greater than this, then the element is filtered
function emphasisFilter(doc, maxTextLength) {
  assert(doc instanceof Document);

  if(typeof maxTextLength === 'undefined') {
    maxTextLength = 0;
  }

  assert(rbl.isPosInt(maxTextLength));

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
}
