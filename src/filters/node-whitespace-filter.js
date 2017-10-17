
'use strict';

// Dependencies:
// assert.js
// string.js

function node_whitespace_filter(doc) {

  ASSERT(doc);

  // Analysis restricted to body because whitespace out of body is
  // unimportant
  if(!doc.body) {
    return;
  }

  const it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    const value = node.nodeValue;
    if(value.length > 3 && !node_whitespace_filter_is_sensitive(node)) {
      const condensed_value = string_condense_whitespace(value);
      if(condensed_value.length !== value.length)
        node.nodeValue = condensed_value;
    }
  }
}

// Returns true if the node lies within a whitespace sensitive element
function node_whitespace_filter_is_sensitive(node) {
  // The closest method only exists on elements, so use the
  // parent element. The closest method also tests against the element itself.
  return node.parentNode.closest('code, pre, ruby, textarea, xmp');
}
