'use strict';

// import base/errors.js

function brFilter(doc) {
  console.assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  const brs = doc.body.querySelectorAll('br + br');
  for(const br of brs) {
    br.remove();
  }

  return RDR_OK;
}
