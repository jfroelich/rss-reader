import assert from "/src/assert.js";

// Filters empty leaf-like nodes from document content
// This module has multiple exports and no default export


export function leafFilter(doc) {
  assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  const documentElement = doc.documentElement;
  const elements = doc.body.querySelectorAll('*');
  for(const element of elements) {
    if(documentElement.contains(element) && leafFilterIsLeaf(element)) {
      element.remove();
    }
  }
}

// Recursive
export function leafFilterIsLeaf(node) {
  switch(node.nodeType) {
  case Node.ELEMENT_NODE: {
    if(isExceptionalElement(node)) {
      return false;
    }

    for(let child = node.firstChild; child; child = child.nextSibling) {
      if(!leafFilterIsLeaf(child)) {
        return false;
      }
    }

    break;
  }
  case Node.TEXT_NODE:
    return !node.nodeValue.trim();
  case Node.COMMENT_NODE:
    return true;
  default:
    return false;
  }

  return true;
}

const EXCEPTION_ELEMENTS = [
  'area', 'audio', 'base', 'col', 'command', 'br', 'canvas', 'col', 'hr', 'iframe', 'img', 'input',
  'keygen', 'meta', 'nobr', 'param', 'path', 'source', 'sbg', 'textarea', 'track', 'video', 'wbr'
];

function isExceptionalElement(element) {
  return EXCEPTION_ELEMENTS.includes(element.localName);
}
