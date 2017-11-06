'use strict';

// import rbl.js
// import filters/filter-helpers.js

function noscriptFilter(doc) {
  assert(doc instanceof Document);

  const noscripts = doc.querySelectorAll('noscript');
  for(const noscript of noscripts) {
    domUnwrap(noscript);
  }
}
