'use strict';

// import base/errors.js
// import filters/filter-helpers.js
// import net/url.js

function script_anchor_filter(doc) {
  console.assert(doc instanceof Document);

  // Restrict analysis to body descendants
  if(!doc.body) {
    return;
  }

  const anchors = doc.body.querySelectorAll('a[href]');
  for(const anchor of anchors) {
    if(url_has_script_protocol(anchor.getAttribute('href'))) {
      dom_unwrap(anchor);
    }
  }

  return RDR_OK;
}
