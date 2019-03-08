import {assert} from '/src/assert.js';

// Change an element from one element type to another by renaming it. As the DOM
// does not allow renaming, we create a new element in place of the old. Returns
// the new element that replaced the old element. Note that in a few cases, such
// as when renaming an element to the same name, the new element that is
// returned may be the same node as the old element. Otherwise the old element
// is detached from the dom and left for GC.
//
// Throws an error when input is invalid (e.g. called on something that is not
// an element, using a bad element name).
//
// Note that due to DOM restrictions, various real time features like event
// listeners are lost during the transition.
export function coerce_element(element, new_name) {
  assert(element instanceof Element);

  // Minimally check the validity of the new name. We want to also explicitly
  // rule out some surprising behavior from the later call to createElement,
  // such as createElement(null) creating an element with the name "null".
  // TODO: consider making this check more accurate
  assert(new_name && typeof new_name === 'string' && !new_name.includes(' '));

  // If the new name is the same as the old, then noop. Assume the document is
  // html flagged and therefore that localName is lowercase.
  if (element.localName === new_name.toLowerCase()) {
    return element;
  }

  // We do not know if the document in which the element resides is the same
  // document as the one executing this function. For security, we make sure to
  // use the element's own document to create the new element. This also avoids
  // node adoption later on.
  const new_element = element.ownerDocument.createElement(new_name);

  // Cache the reference to the old element's parent prior to removal.
  const parent = element.parentNode;
  // Noop attempts to coerce an orphan.
  if (!parent) {
    return element;
  }

  // We want to place the new element into the same position as the old element
  // later using insertBefore, which can easily be done by knowing the parent
  // element and the next adjacent node (if one exists). However, we plan to
  // remove the old element prior to attaching the new element, and the link to
  // nextSibling will be destroyed when removing the old element. Therefore we
  // keep around the old reference prior to detachment. Note that this value may
  // be undefined, which is fine, due to how the later call to insertBefore
  // behaves when its second argument is undefined.
  const next_sibling = element.nextSibling;

  // Detach the old element prior to moving child nodes from the old element to
  // the new element. We could do this later, but we are naive regarding whether
  // the element's document is inert or live. If live, it is better performance
  // to move descendants while in the detached state. If inert, it is
  // immaterial.
  element.remove();

  // Copy attributes from source to destination, regardless of validity.
  // Validity conerns are left to the caller.
  const names = element.getAttributeNames();
  for (const name of names) {
    new_element.setAttribute(name, element.getAttribute(name));
  }

  // We only move child nodes if the new element does not look like a void
  // element.
  const void_elements = [
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
    'param', 'source', 'track', 'wbr'
  ];
  if (!void_elements.includes(new_element.localName)) {
    // Move the nodes one at a time, maintaining order. Each appendChild call
    // causes firstChild to point to the next node.
    for (let node = element.firstChild; node; node = element.firstChild) {
      new_element.appendChild(node);
    }
  }

  // Insert the new element into the element's owner document in the same
  // position as the old node, and return the new element. When the next sibling
  // is undefined, insertBefore behaves like appendChild.
  return parent.insertBefore(new_element, next_sibling);
}
