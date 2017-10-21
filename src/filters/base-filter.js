'use strict';

// import base/assert.js
// import base/status.js

function base_filter(doc) {
  ASSERT(doc instanceof Document);
  const bases = doc.querySelectorAll('base');
  for(const base of bases) {
    base.remove();
  }
  return STATUS_OK;
}
