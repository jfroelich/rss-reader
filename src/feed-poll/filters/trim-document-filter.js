// Remove whitespace and whitespace-like content from the start and end of a
// document's body.
export default function trimDocumentFilter(doc) {
  if (!(doc instanceof Document)) {
    throw new TypeError('Invalid document parameter', doc);
  }

  if (!doc.body) {
    return;
  }

  const firstChild = doc.body.firstChild;
  if (firstChild) {
    step(firstChild, 'nextSibling');
    const lastChild = doc.body.lastChild;
    if (lastChild && lastChild !== firstChild) {
      step(lastChild, 'previousSibling');
    }
  }
}

function step(startNode, edgeName) {
  let node = startNode;
  while (node && isTrimmable(node)) {
    const sibling = node[edgeName];
    node.remove();
    node = sibling;
  }
}

function isTrimmable(node) {
  // Leave it up to the engine to determine if this is a hotspot that needs
  // hoisting
  const spaceElements = ['br', 'hr', 'nobr'];

  if (node.nodeType === Node.TEXT_NODE) {
    return !node.nodeValue.trim();
  } else {
    return spaceElements.includes(node.localName);
  }
}
