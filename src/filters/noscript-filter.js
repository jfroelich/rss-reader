'use strict';

// import base/status.js
// import filters/filter-helpers.js

function noscript_filter(doc) {
  console.assert(doc instanceof Document);

  const noscripts = doc.querySelectorAll('noscript');
  for(const noscript of noscripts) {
    unwrap_element(noscript);
  }

  return STATUS_OK;
}
