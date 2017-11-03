'use strict';

// import base/assert.js
// import base/errors.js
// import filters/filter-helpers.js

function containerFilter(doc) {
  assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  unwrapElements(doc.body, 'div, ilayer, layer');
  return RDR_OK;
}
