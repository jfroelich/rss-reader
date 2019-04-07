import assert from '/src/lib/assert.js';

// TODO: increase the accuracy of the element name sanity check
// TODO: for moving child nodes, use a document fragment like in unwrap-element

// Change an element from one element type to another by renaming it. Returns
// the new element that replaced the old element, or the original element if
// no change was made (e.g. because the new name is not different). Event
// listeners are not retained by this operation.
export default function coerce_element(element, new_name) {
  assert(element instanceof Element);
  assert(new_name && typeof new_name === 'string' && !new_name.includes(' '));

  if (element.localName === new_name.toLowerCase()) {
    return element;
  }

  const new_element = element.ownerDocument.createElement(new_name);
  const parent = element.parentNode;
  if (!parent) {
    return element;
  }

  const next_sibling = element.nextSibling;
  element.remove();

  const names = element.getAttributeNames();
  for (const name of names) {
    new_element.setAttribute(name, element.getAttribute(name));
  }

  const void_elements = [
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
    'param', 'source', 'track', 'wbr'
  ];
  if (!void_elements.includes(new_element.localName)) {
    for (let node = element.firstChild; node; node = element.firstChild) {
      new_element.append(node);
    }
  }

  return parent.insertBefore(new_element, next_sibling);
}
