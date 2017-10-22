'use strict';

// import base/status.js

function base_filter(doc) {
  console.assert(doc instanceof Document);
  const bases = doc.querySelectorAll('base');
  for(const base of bases) {
    base.remove();
  }
  return STATUS_OK;
}
