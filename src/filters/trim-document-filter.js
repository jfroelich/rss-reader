'use strict';

// import base/errors.js

// Remove whitespace and whitespace-like content from the start and end of
// a document's body.
function trimDocumentFilter(doc) {
  console.assert(doc instanceof Document);

  if(!doc.body) {
    return RDR_OK;
  }

  const firstChild = doc.body.firstChild;
  if(firstChild) {
    // Trim from the front
    trimDocumentFilterStep(firstChild, 'nextSibling');

    // Trim from the back
    const lastChild = doc.body.lastChild;
    if(lastChild && lastChild !== firstChild) {
      trimDocumentFilterStep(lastChild, 'previousSibling');
    }
  }

  return RDR_OK;
}

function trimDocumentFilterStep(startNode, edgeName) {
  let node = startNode;
  while(trimDocumentFilterIsTrimmable(node)) {
    const sibling = node[edgeName];
    node.remove();
    node = sibling;
  }
}

function trimDocumentFilterIsTrimmable(node) {
  const elements = ['br', 'hr', 'nobr'];
  return node && (elements.includes(node.localName) ||
    (node.nodeType === Node.TEXT_NODE && !node.nodeValue.trim()));
}
