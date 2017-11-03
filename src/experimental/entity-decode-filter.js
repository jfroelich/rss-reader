'use strict';

// import base/assert.js
// import base/errors.js

function entityDecodeFilter(doc) {
  assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  return RDR_OK;
}
