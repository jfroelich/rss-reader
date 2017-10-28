'use strict';

// import base/status.js

// TODO: this should be part of a general character normalization filter,
// or perhaps a whitespace normalization filter, or an entity filter
// TODO: accessing nodeValue does decoding, so maybe this doesn't work? Forgot.
// TODO: this needs testing to test whether it actually works, I don't think
// this works.
function hairspace_filter(doc) {
  console.assert(doc instanceof Document);

  // Restrict analysis to body descendants. While hairspaces can occur
  // outside of body, we don't care about normalizing them, because they will
  // never be displayed or processed later.
  if(!doc.body) {
    return;
  }

  const it = doc.createNodeIterator(doc.body, NodeFilter.SHOW_TEXT);
  for(let node = it.nextNode(); node; node = it.nextNode()) {
    const value = node.nodeValue;
    const modified_value = value.replace(/&(hairsp|#8082|#x200a);/ig, ' ');
    if(modified_value.length !== value.length) {
      node.nodeValue = modified_value;
    }
  }

  return STATUS_OK;
}
