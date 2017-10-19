'use strict';

// import assert.js
// import string.js

function node_whitespace_filter(doc) {
  ASSERT(doc);

  if(!doc.body) {
    return;
  }

  const it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    const value = node.nodeValue;
    if(value.length > 3 && !node_whitespace_filter_is_sensitive(node)) {
      const condensed_value = string_condense_whitespace(value);
      if(condensed_value.length !== value.length) {
        node.nodeValue = condensed_value;
      }
    }
  }
}

function node_whitespace_filter_is_sensitive(node) {
  const selector = 'code, pre, ruby, script, style, textarea, xmp';
  return node.parentNode.closest(selector);
}
