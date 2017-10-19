'use strict';

// import assert.js

function script_filter(doc) {
  ASSERT(doc);
  const scripts = doc.querySelectorAll('script');
  for(const script of scripts) {
    script.remove();
  }
}
