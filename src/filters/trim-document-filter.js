import assert from "/src/assert.js";

// Remove whitespace and whitespace-like content from the start and end of a document's body.
export default function filterDocument(doc) {
  assert(doc instanceof Document);
  if(!doc.body) {
    return;
  }

  const firstChild = doc.body.firstChild;
  if(firstChild) {
    step(firstChild, 'nextSibling');
    const lastChild = doc.body.lastChild;
    if(lastChild && lastChild !== firstChild) {
      step(lastChild, 'previousSibling');
    }
  }
}

function step(startNode, edgeName) {
  let node = startNode;
  while(node && isTrimmable(node)) {
    const sibling = node[edgeName];
    node.remove();
    node = sibling;
  }
}

const kTrimmableElementNames = ['br', 'hr', 'nobr'];

function isTrimmable(node) {
  if(node.nodeType === Node.TEXT_NODE) {
    return !node.nodeValue.trim();
  } else {
    return kTrimmableElementNames.includes(node.localName);
  }
}
