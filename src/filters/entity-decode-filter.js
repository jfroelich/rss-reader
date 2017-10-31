'use strict';

// import base/errors.js

function entity_decode_filter(doc) {
  console.assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  return RDR_OK;
}
