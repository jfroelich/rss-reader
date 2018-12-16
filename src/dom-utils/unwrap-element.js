// Replace |element| with its child nodes. If |nag| is true then warn when
// unwrapping an orphaned node. |nag| is optional, defaults to true.
export function unwrap_element(element, nag = true) {
  // Unwrapping an orphaned node is pointless. Rather than error, just exit
  // early for caller convenience.
  if (!element.parentNode) {
    // Encourage the caller to change their behavior
    if (nag) {
      console.warn('Tried to unwrap orphaned element', element.outerHTML);
    }
    return;
  }

  const owner = element.ownerDocument;
  const parent = element.parentNode;
  const psib = element.previousSibling;
  const nsib = element.nextSibling;
  const fchild = element.firstChild;
  const lchild = element.lastChild;
  const TEXT = Node.TEXT_NODE;
  const frag = owner.createDocumentFragment();

  element.remove();

  // TODO: what if the preceding text ends in whitespace, or the trailing text
  // starts with whitespace? should unwrap not append in that case? or what
  // if the text within the element starts or ends in whitespace?

  if (psib && fchild && psib.nodeType === TEXT && fchild.nodeType === TEXT) {
    frag.appendChild(owner.createTextNode(' '));
  }

  for (let node = fchild; node; node = element.firstChild) {
    frag.appendChild(node);
  }

  if (lchild && nsib && nsib.nodeType === TEXT && lchild.nodeType === TEXT) {
    frag.appendChild(owner.createTextNode(' '));
  }

  // Create one trailing space if the element was empty between two text nodes.
  // If an element is empty then its firstChild is falsy (and its lastChild is
  // also falsy).
  if (!fchild && psib && nsib && psib.nodeType === TEXT &&
      nsib.nodeType === TEXT) {
    frag.appendChild(owner.createTextNode(' '));
  }

  parent.insertBefore(frag, nsib);
}
