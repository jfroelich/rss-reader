'use strict';

// import base/assert.js
// import base/errors.js
// import filters/filter-helpers.js

function noscriptFilter(doc) {
  assert(doc instanceof Document);

  const noscripts = doc.querySelectorAll('noscript');
  for(const noscript of noscripts) {
    domUnwrap(noscript);
  }

  return RDR_OK;
}
