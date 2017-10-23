'use strict';

// import base/number.js
// import base/status.js
// import filters/filter-helpers.js

// @param max_text_length {Number} optional, if number of non-tag characters
// within emphasis element is greater than this, then the element is filtered
function emphasis_filter(doc, max_text_length) {
  console.assert(doc instanceof Document);

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
      console.log('emphasis-filtering:', element.innerHTML);
      unwrap_element(element);
    }
  }

  return STATUS_OK;
}
