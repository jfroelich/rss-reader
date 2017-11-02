'use strict';

// import base/errors.js

function scriptFilter(doc) {
  console.assert(doc instanceof Document);

  const scripts = doc.querySelectorAll('script');
  for(const script of scripts) {
    script.remove();
  }

  return RDR_OK;
}
