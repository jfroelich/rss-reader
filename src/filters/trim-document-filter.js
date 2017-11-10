'use strict';

// import rbl.js

// Remove whitespace and whitespace-like content from the start and end of
// a document's body.
function trimDocumentFilter(doc) {
  assert(doc instanceof Document);

  if(!doc.body) {
    return;
  }

  const firstChild = doc.body.firstChild;
  if(firstChild) {
    trimDocumentFilterStep(firstChild, 'nextSibling');
    const lastChild = doc.body.lastChild;
    if(lastChild && lastChild !== firstChild) {
      trimDocumentFilterStep(lastChild, 'previousSibling');
    }
  }
}

function trimDocumentFilterStep(startNode, edgeName) {
  let node = startNode;
  while(node && trimDocumentFilterIsTrimmable(node)) {
    const sibling = node[edgeName];
    node.remove();
    node = sibling;
  }
}

function trimDocumentFilterIsTrimmable(node) {
  const elements = ['br', 'hr', 'nobr'];

  if(node.nodeType === Node.TEXT_NODE) {
    return !node.nodeValue.trim();
  } else {
    return elements.includes(node.localName);
  }
}
