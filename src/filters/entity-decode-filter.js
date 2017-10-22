'use strict';

// import base/status.js

function entity_decode_filter(doc) {
  console.assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  return STATUS_OK;
}
