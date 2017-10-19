'use strict';

// import assert.js
// import debug.js

const EMPHASIS_FILTER_DEBUG = true;

function emphasis_filter(doc, max_text_length) {
  ASSERT(doc);

  if(!doc.body) {
    return;
  }

  const elements = doc.body.querySelectorAll('b, big, em, i, strong');
  for(const element of elements) {
    if(emphasis_filter_needs_prune(element, max_text_length)) {

      if(EMPHASIS_FILTER_DEBUG) {
        DEBUG('emphasis-filtering:', element);
      }

      unwrap_element(element);
    }
  }
}

// Return true if too much text
function emphasis_filter_needs_prune(element, max_text_length) {
  return element.textContent.length > max_text_length;
}
