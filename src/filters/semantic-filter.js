'use strict';

// import base/assert.js
// import base/errors.js
// import filters/filter-helpers.js

function semanticFilter(doc) {
  assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  unwrapElements(doc.body, 'article, aside, footer, header, main, section');
  return RDR_OK;
}
