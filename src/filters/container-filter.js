'use strict';

// import base/assert.js
// import filters/filter-helpers.js

function container_filter(doc) {
  ASSERT(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  unwrap_elements(doc.body, 'div, ilayer, layer');
}
