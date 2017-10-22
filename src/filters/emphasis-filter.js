'use strict';

// import base/debug.js
// import base/number.js
// import base/status.js
// import filters/filter-helpers.js

const EMPHASIS_FILTER_DEBUG = true;

function emphasis_filter(doc, max_text_length) {
  console.assert(doc instanceof Document);

  // max_text_length is optional
  if(typeof max_text_length === 'undefined') {
    max_text_length = 0;
  }

  console.assert(number_is_positive_integer(max_text_length));

  // Restrict analysis to body
  if(!doc.body) {
    return;
  }

  const elements = doc.body.querySelectorAll('b, big, em, i, strong');
  for(const element of elements) {
    if(element.textContent.length > max_text_length) {

      if(EMPHASIS_FILTER_DEBUG) {
        DEBUG('emphasis-filtering:', element.innerHTML);
      }

      unwrap_element(element);
    }
  }

  return STATUS_OK;
}
