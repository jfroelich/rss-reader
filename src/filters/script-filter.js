'use strict';

// import base/assert.js
// import base/status.js

function script_filter(doc) {
  ASSERT(doc instanceof Document);

  const scripts = doc.querySelectorAll('script');
  for(const script of scripts) {
    script.remove();
  }

  return STATUS_OK;
}
