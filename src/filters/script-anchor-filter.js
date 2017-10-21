'use strict';

// import base/assert.js
// import filters/filter-helpers.js
// import http/url.js

function script_anchor_filter(doc) {
  ASSERT(doc instanceof Document);

  // Restrict analysis to body descendants
  if(!doc.body) {
    return;
  }

  const anchors = doc.body.querySelectorAll('a[href]');
  for(const anchor of anchors) {
    if(url_has_script_protocol(anchor.getAttribute('href'))) {
      unwrap_element(anchor);
    }
  }
}
