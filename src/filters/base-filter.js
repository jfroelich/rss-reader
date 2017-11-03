'use strict';

// import base/assert.js
// import base/errors.js

function baseFilter(doc) {
  assert(doc instanceof Document);
  const bases = doc.querySelectorAll('base');
  for(const base of bases) {
    base.remove();
  }
  return RDR_OK;
}
