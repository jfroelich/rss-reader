'use strict';

// import rbl.js

// @throws AssertionError
function entityDecodeFilter(doc) {
  assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  throw new Error('Not implemented');
}
