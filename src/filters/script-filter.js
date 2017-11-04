'use strict';

// import base/assert.js

function scriptFilter(doc) {
  assert(doc instanceof Document);

  const scripts = doc.querySelectorAll('script');
  for(const script of scripts) {
    script.remove();
  }
}
