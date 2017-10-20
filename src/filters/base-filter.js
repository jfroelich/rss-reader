'use strict';

// import base/assert.js

function base_filter(doc) {
  // TODO: use document_is_document
  ASSERT(doc);
  const bases = doc.querySelectorAll('base');
  for(const base of bases) {
    base.remove();
  }
}
