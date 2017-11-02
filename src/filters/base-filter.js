'use strict';

// import base/errors.js

function baseFilter(doc) {
  console.assert(doc instanceof Document);
  const bases = doc.querySelectorAll('base');
  for(const base of bases) {
    base.remove();
  }
  return RDR_OK;
}
