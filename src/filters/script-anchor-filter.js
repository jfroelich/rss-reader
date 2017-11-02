'use strict';

// import base/errors.js
// import filters/filter-helpers.js
// import net/url.js

function scriptAnchorFilter(doc) {
  console.assert(doc instanceof Document);

  // Restrict analysis to body descendants
  if(!doc.body) {
    return;
  }

  const anchors = doc.body.querySelectorAll('a[href]');
  for(const anchor of anchors) {
    if(urlHasScriptProtocol(anchor.getAttribute('href'))) {
      domUnwrap(anchor);
    }
  }

  return RDR_OK;
}
