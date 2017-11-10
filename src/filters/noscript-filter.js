'use strict';

// import filters/filter-helpers.js
// import rbl.js

function noscriptFilter(doc) {
  assert(doc instanceof Document);

  const noscripts = doc.querySelectorAll('noscript');
  for(const noscript of noscripts) {
    domUnwrap(noscript);
  }
}
