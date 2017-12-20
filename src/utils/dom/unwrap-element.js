import assert from "/src/assert/assert.js";

// Replace an element with its children. Special care is taken to add spaces if the operation would
// result in adjacent text nodes.
export default function unwrap(element) {
  assert(element instanceof Element);
  assert(element.parentNode instanceof Element, 'Tried to unwrap orphaned element',
    element.outerHTML);

  const parentElement = element.parentNode;
  const previousSibling = element.previousSibling;
  const nextSibling = element.nextSibling;
  const firstChild = element.firstChild;
  const lastChild = element.lastChild;
  const TEXT = Node.TEXT_NODE;
  const frag = element.ownerDocument.createDocumentFragment();

  // Detach upfront for O(2) live dom ops, compared to O(n-children) otherwise
  element.remove();

  // Add leading padding
  if(previousSibling && previousSibling.nodeType === TEXT && firstChild &&
    firstChild.nodeType === TEXT) {
    frag.appendChild(element.ownerDocument.createTextNode(' '));
  }

  // Move children to fragment, maintaining order
  for(let node = firstChild; node; node = element.firstChild) {
    frag.appendChild(node);
  }

  // Add trailing padding
  if(lastChild && firstChild !== lastChild && nextSibling && nextSibling.nodeType === TEXT &&
    lastChild.nodeType === TEXT) {
    frag.appendChild(element.ownerDocument.createTextNode(' '));
  }

  // If nextSibling is undefined then insertBefore appends
  parentElement.insertBefore(frag, nextSibling);
}
