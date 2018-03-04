
export function assert(value, message) {
  if (!value) throw new Error(message || 'Assertion error');
}


// TODO: inline
export function element_coerce_all(
    ancestor_element, old_name, new_name, copy_attributes_flag) {
  assert(ancestor_element instanceof Element);
  assert(typeof old_name === 'string');
  assert(typeof new_name === 'string');

  const elements = ancestor_element.querySelectorAll(old_name);
  for (const element of elements) {
    element_coerce(element, new_name, copy_attributes_flag);
  }
}

export function element_coerce(element, new_name, copy_attributes_flag = true) {
  assert(element instanceof Element);
  assert(element_name_is_valid(new_name));

  if (element.localName === new_name.toLowerCase()) {
    return element;
  }

  // TODO: rename var
  const parent_element = element.parentNode;
  if (!parent_element) {
    return element;
  }

  // TODO: rename var
  // Use next sibling to record position prior to detach. May be undefined.
  const nsib = element.nextSibling;

  // Detach the existing node prior to performing other dom operations so that
  // later operations take place on a detached node, so that the least amount
  // of live dom operations are made. Implicitly this sets element.parentNode
  // and element.nextSibling to undefined.
  element.remove();

  // NOTE: a detached element is still 'owned' by a document
  // NOTE: we are using the document in which the element resides, not the
  // document executing this function. This would otherwise be a serious XSS
  // vulnerability, and also possibly trigger document adoption (which is slow).

  const new_element = element.ownerDocument.createElement(new_name);

  if (copy_attributes_flag) {
    element_copy_attributes(element, new_element);
  }

  element_move_child_nodes(element, new_element);

  // Attach the new element in place of the old element. If nextSibling is
  // undefined then insertBefore simply appends. Return the new element.
  return parent_element.insertBefore(new_element, nsib);
}

// Move all child nodes of from_element to to_element, maintaining order. If
// to_element has existing children, the new elements are appended at the end.
// NOTE: I've looked for ways of doing this faster, but nothing seems to work.
// There is no batch move operation in native dom.
// TODO: one possible speedup might be using a document fragment? See what I
// did for unwrap
// TODO: might not need to export
export function element_move_child_nodes(from_element, to_element) {
  // If the target is a void element then this is a no-op. This assumes the
  // source element is detached. The result in this case is the child nodes
  // are effectively deleted.
  if (element_is_void(to_element)) {
    return;
  }

  // Each call to appendChild does the move. As such, in each iteration, the
  // next accessing of old parent's firstChild points to the old parent's new
  // first child, if any children are left.
  let node = from_element.firstChild;
  while (node) {
    to_element.appendChild(node);
    node = from_element.firstChild;
  }
}

// See https://html.spec.whatwg.org/multipage/syntax.html#void-elements
// This is a set, but given the small size, it is better to use a simple array.
export const void_elements = [
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr'
];

// Returns whether an element is a void element. This assumes
// element.ownerDocument is implicitly flagged as html so that localName yields
// the normalized name which is in lowercase. For now I'd rather make the
// assumption and let errors happen than incur the cost of calling toLowerCase
export function element_is_void(element) {
  return void_elements.includes(element.localName);
}

// Returns true if the given name is a valid name for an element. This only
// does minimal validation and may yield false positives. This function is
// defensive so it can easily be asserted against.
// TODO: research what characters are allowed in an element's name
function element_name_is_valid(value) {
  return typeof value === 'string' && value.length && !value.includes(' ');
}

// Copies the attributes of an element to another element. Overwrites any
// existing attributes in the other element.
// @param from_element {Element}
// @param to_element {Element}
// @throws {Error} if either element is not an Element
// @returns void
export function element_copy_attributes(from_element, to_element) {
  // Use getAttributeNames in preference to element.attributes due to
  // performance issues with element.attributes, and to allow unencumbered use
  // of the for..of syntax (I had issues with NamedNodeMap and for..of).
  const names = from_element.getAttributeNames();
  for (const name of names) {
    const value = from_element.getAttribute(name);
    to_element.setAttribute(name, value);
  }
}
