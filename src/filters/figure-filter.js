'use strict';

// import base/status.js
// import filters/filter-helpers.js

function figure_filter(doc) {
  console.assert(doc instanceof Document);

  if(!doc.body) {
    return STATUS_OK;
  }

  // Unwrap captionless figures. Any figure with only 1 child has either only
  // a caption or only an image or something else, rendering it meaningless
  const figures = doc.body.querySelectorAll('figure');
  for(const figure of figures) {
    if(figure.childElementCount === 1) {
      unwrap_element(figure);
    }
  }

  return STATUS_OK;
}
