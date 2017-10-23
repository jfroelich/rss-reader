'use strict';

// import base/status.js

function br_filter(doc) {
  console.assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  const brs = doc.body.querySelectorAll('br + br');
  for(const br of brs) {
    br.remove();
  }

  return STATUS_OK;
}
