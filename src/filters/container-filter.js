'use strict';

// import base/errors.js
// import filters/filter-helpers.js

function container_filter(doc) {
  console.assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  unwrap_elements(doc.body, 'div, ilayer, layer');
  return RDR_OK;
}
