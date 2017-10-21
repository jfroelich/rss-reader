'use strict';

// import base/assert.js
// import base/debug.js
// import base/status.js
// import filters/filter-helpers.js

const EMPHASIS_FILTER_DEBUG = true;

function emphasis_filter(doc, max_text_length) {
  ASSERT(doc instanceof Document);

  // Not specifying max length is not an error, it just signals
  // not to do anything.
  if(typeof max_text_length === 'undefined') {
    return;
  }

  ASSERT(Number.isInteger(max_text_length));
  ASSERT(max_text_length >= 0);

  // Restrict analysis to body
  if(!doc.body) {
    return;
  }

  // No point of processing if 0
  if(max_text_length < 1) {
    return;
  }

  const elements = doc.body.querySelectorAll('b, big, em, i, strong');
  for(const element of elements) {
    if(element.textContent.length > max_text_length) {

      if(EMPHASIS_FILTER_DEBUG) {
        DEBUG('emphasis-filtering:', element);
      }

      unwrap_element(element);
    }
  }

  return STATUS_OK;
}
