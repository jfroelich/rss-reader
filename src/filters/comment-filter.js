'use strict';

// import base/assert.js

function comment_filter(doc) {
  ASSERT(doc instanceof Document);

  const it = doc.createNodeIterator(doc.documentElement,
    NodeFilter.SHOW_COMMENT);
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    node.remove();
  }
}
