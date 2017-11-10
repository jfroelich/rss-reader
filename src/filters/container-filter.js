'use strict';

// import filters/filter-helpers.js
// import rbl.js

function containerFilter(doc) {
  assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  unwrapElements(doc.body, 'div, ilayer, layer');
}
