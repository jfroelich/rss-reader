'use strict';

// import base/assert.js

function brFilter(doc) {
  assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  const brs = doc.body.querySelectorAll('br + br');
  for(const br of brs) {
    br.remove();
  }
}
