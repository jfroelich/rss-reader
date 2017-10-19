'use strict';

// Dependencies:
// assert.js

function invalid_anchor_filter(doc) {

  ASSERT(doc);

  // Restrict to body descendants
  if(!doc.body) {
    return;
  }

  const anchors = doc.body.querySelectorAll('a');
  for(const anchor of anchors) {
    if(invalid_anchor_filter_is_invalid(anchor)) {
      anchor.remove();
    }
  }
}

function invalid_anchor_filter_is_invalid(anchor_element) {
  const href_value = anchor_element.getAttribute('href');
  return href_value && /^\s*https?:\/\/#/i.test(href_value);
}
