'use strict';

// import assert.js
// import transform-helpers.js

function noscript_filter(doc) {
  const noscripts = doc.querySelectorAll('noscript');
  for(const noscript of noscripts) {
    unwrap_element(noscript);
  }
}
