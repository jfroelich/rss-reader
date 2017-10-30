'use strict';

// import base/status.js
// import dom.js

const LEAF_FILTER_EXCEPTION_ELEMENTS = [
  'area', 'audio', 'base', 'col', 'command', 'br', 'canvas', 'col', 'hr',
  'iframe', 'img', 'input', 'keygen', 'meta', 'nobr', 'param', 'path',
  'source', 'sbg', 'textarea', 'track', 'video', 'wbr'
];

function leaf_filter(doc) {
  console.assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  const doc_element = doc.documentElement;

  const elements = doc.body.querySelectorAll('*');
  for(const element of elements) {
    if(doc_element.contains(element) && leaf_filter_is_leaf(element))
      element.remove();
  }

  return STATUS_OK;
}


// Recursive
function leaf_filter_is_leaf(node) {
  switch(node.nodeType) {
    case Node.ELEMENT_NODE:
      if(leaf_filter_is_exception(node)) {
        return false;
      }

      for(let child = node.firstChild; child; child = child.nextSibling) {
        if(!leaf_filter_is_leaf(child)) {
          return false;
        }
      }

      break;
    case Node.TEXT_NODE:
      return !node.nodeValue.trim();
    case Node.COMMENT_NODE:
      return true;
    default:
      return false;
  }

  return true;
}



function leaf_filter_is_exception(element) {
  return LEAF_FILTER_EXCEPTION_ELEMENTS.includes(element.localName);
}
