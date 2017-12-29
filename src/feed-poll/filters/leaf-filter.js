import assert from "/src/common/assert.js";

// Filters empty leaf-like nodes from document content
// This module has multiple exports and no default export

// TODO: remove near empty anchor elements, e.g. only containing whitespace text nodes,
// that result from removing nested elements in other filters. Or at least investigate why
// it isn't getting removed, because it looks like it should be. Or the problem is that this
// doesn't consider the ripple effect of how removing a leaf leads to other leaves?
// The problem occurs at http://freakonomics.com/podcast/make-match-rebroadcast/
// TODO: re-use void elements list from dom utils

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
