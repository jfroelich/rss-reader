'use strict';

// import base/status.js

function semantic_filter(doc) {
  console.assert(doc);

  if(!doc.body) {
    return;
  }

  unwrap_elements(doc.body, 'article, aside, footer, header, main, section');
  return STATUS_OK;
}
