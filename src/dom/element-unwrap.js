export function element_unwrap(element) {
  if (!(element instanceof Element)) {
    throw new TypeError('element is not an element');
  }

  // An orphaned node is any parentless node. An orphaned node is obviously
  // detached from the document, as all attached nodes have a parent. There is
  // generally no benefit to unwrapping orphans.
  //
  // Although attempting to unwrap an orphaned node should probably represent a
  // programming error, and so in some sense this case should never be true,
  // just exit early. Encourage the caller to change their behavior.
  if (!element.parentNode) {
    console.warn('Tried to unwrap orphaned element', element.outerHTML);
    return;
  }

  // Cache stuff prior to removal
  const parent_element = element.parentNode;
  const psib = element.previousSibling;
  const nsib = element.nextSibling;
  const fchild = element.firstChild;
  const lchild = element.lastChild;
  const TEXT = Node.TEXT_NODE;
  const frag = element.ownerDocument.createDocumentFragment();

  // Detach upfront for O(2) live dom ops, compared to O(n-children) otherwise
  element.remove();

  // Add leading padding
  if (psib && psib.nodeType === TEXT && fchild && fchild.nodeType === TEXT) {
    frag.appendChild(element.ownerDocument.createTextNode(' '));
  }

  // Move children to fragment, maintaining order
  for (let node = fchild; node; node = element.firstChild) {
    frag.appendChild(node);
  }

  // Add trailing padding
  if (lchild && fchild !== lchild && nsib && nsib.nodeType === TEXT &&
      lchild.nodeType === TEXT) {
    frag.appendChild(element.ownerDocument.createTextNode(' '));
  }

  // If nsib is undefined then insertBefore appends
  parent_element.insertBefore(frag, nsib);
}
