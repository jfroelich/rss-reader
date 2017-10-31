'use strict';

// import base/errors.js
// import filters/filter-helpers.js

function semantic_filter(doc) {
  console.assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  unwrap_elements(doc.body, 'article, aside, footer, header, main, section');
  return RDR_OK;
}
