'use strict';

// import base/errors.js

function base_filter(doc) {
  console.assert(doc instanceof Document);
  const bases = doc.querySelectorAll('base');
  for(const base of bases) {
    base.remove();
  }
  return RDR_OK;
}
