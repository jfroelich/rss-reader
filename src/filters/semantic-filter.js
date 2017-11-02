'use strict';

// import base/errors.js
// import filters/filter-helpers.js

function semanticFilter(doc) {
  console.assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  unwrapElements(doc.body, 'article, aside, footer, header, main, section');
  return RDR_OK;
}
