'use strict';

// import base/assert.js
// import base/errors.js

function commentFilter(doc) {
  assert(doc instanceof Document);
  const it = doc.createNodeIterator(doc.documentElement,
    NodeFilter.SHOW_COMMENT);
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    node.remove();
  }
  return RDR_OK;
}
