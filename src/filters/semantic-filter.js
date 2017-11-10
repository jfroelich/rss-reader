'use strict';

// import filters/filter-helpers.js
// import rbl.js

function semanticFilter(doc) {
  assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  unwrapElements(doc.body, 'article, aside, footer, header, main, section');
}
