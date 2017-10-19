'use strict';

// import "assert.js"

function base_filter(doc) {
  ASSERT(doc);
  const bases = doc.querySelectorAll('base');
  for(const base of bases) {
    base.remove();
  }
}
