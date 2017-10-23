'use strict';

// import base/status.js

function comment_filter(doc) {
  console.assert(doc instanceof Document);

  const it = doc.createNodeIterator(doc.documentElement,
    NodeFilter.SHOW_COMMENT);
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    node.remove();
  }
  return STATUS_OK;
}
