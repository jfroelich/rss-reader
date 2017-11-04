'use strict';

// import base/assert.js

// @throws AssertionError
function entityDecodeFilter(doc) {
  assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  throw new Error('Not implemented');
}
