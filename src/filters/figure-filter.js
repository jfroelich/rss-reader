'use strict';

// import base/assert.js
// import filters/filter-helpers.js

function figureFilter(doc) {
  assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  // Unwrap captionless figures. Any figure with only 1 child has either only
  // a caption or only an image or something else, rendering it meaningless
  const figures = doc.body.querySelectorAll('figure');
  for(const figure of figures) {
    if(figure.childElementCount === 1) {
      domUnwrap(figure);
    }
  }
}
