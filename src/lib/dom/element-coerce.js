export function element_coerce(element, new_name, copy_attributes = true) {
  if (!(element instanceof Element)) {
    throw new TypeError('element is not an Element');
  }

  if (!element_name_is_valid(new_name)) {
    throw new TypeError('Invalid new name ' + new_name);
  }

  if (element.localName === new_name.toLowerCase()) {
    return element;
  }

  const parent_element = element.parentNode;
  if (!parent_element) {
    return element;
  }

  const next_sibling = element.nextSibling;
  element.remove();

  const new_element = element.ownerDocument.createElement(new_name);
  if (copy_attributes) {
    element_copy_attributes(element, new_element);
  }

  element_move_child_nodes(element, new_element);
  return parent_element.insertBefore(new_element, next_sibling);
}

export function element_move_child_nodes(from_element, to_element) {
  if (element_is_void(to_element)) {
    return;
  }

  let node = from_element.firstChild;
  while (node) {
    to_element.appendChild(node);
    node = from_element.firstChild;
  }
}

export const void_elements = [
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr'
];

export function element_is_void(element) {
  return void_elements.includes(element.localName);
}

function element_name_is_valid(value) {
  return typeof value === 'string' && value.length && !value.includes(' ');
}

export function element_copy_attributes(from_element, to_element) {
  const names = from_element.getAttributeNames();
  for (const name of names) {
    const value = from_element.getAttribute(name);
    to_element.setAttribute(name, value);
  }
}
