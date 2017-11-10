'use strict';

// import rbl.js
// import filters/filter-helpers.js
// import url-utils.js

function scriptAnchorFilter(doc) {
  assert(doc instanceof Document);

  // Restrict analysis to body descendants
  if(!doc.body) {
    return;
  }

  const anchors = doc.body.querySelectorAll('a[href]');
  for(const anchor of anchors) {
    if(URLUtils.hasScriptProtocol(anchor.getAttribute('href'))) {
      domUnwrap(anchor);
    }
  }
}
