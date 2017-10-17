// script security lib

'use strict';

// Dependencies:
// assert.js

function script_filter(doc) {
  ASSERT(doc);

  // Not restricted to body. Scripts can be anywhere.

  const scripts = doc.querySelectorAll('script');
  for(const script of scripts) {
    script.remove();
  }
}
