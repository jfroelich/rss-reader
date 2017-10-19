'use strict';

// import assert.js

function br_filter(doc) {
  ASSERT(doc);

  if(!doc.body) {
    return;
  }

  const brs = doc.body.querySelectorAll('br + br');
  for(const br of brs) {
    br.remove();
  }
}
