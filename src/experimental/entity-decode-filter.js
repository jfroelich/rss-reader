'use strict';

// import base/errors.js

function entityDecodeFilter(doc) {
  console.assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  return RDR_OK;
}
