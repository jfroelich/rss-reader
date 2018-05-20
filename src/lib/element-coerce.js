// TODO: move the docs back into here as comments, it is much easier to maintain
// and more standalone
// TODO: add console parameter
// TODO: rename to coerce-element (both file and function)
// TODO: maybe move to subfolder element within lib
// TODO: maybe merge into its one callsite

export function element_coerce(element, new_name, copy_attributes = true) {
  if (!(element instanceof Element)) {
    throw new TypeError('element is not an Element');
  }

  if (!is_valid_element_name(new_name)) {
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
    copy_element_attributes(element, new_element);
  }

  move_child_nodes(element, new_element);

  return parent_element.insertBefore(new_element, next_sibling);
}

export function move_child_nodes(from_element, to_element) {
  if (is_void_element(to_element)) {
    return;
  }

  let node = from_element.firstChild;
  while (node) {
    to_element.appendChild(node);
    node = from_element.firstChild;
  }
}

const void_elements = [
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr'
];

export function is_void_element(element) {
  return void_elements.includes(element.localName);
}

function is_valid_element_name(value) {
  return typeof value === 'string' && value.length && !value.includes(' ');
}

export function copy_element_attributes(from_element, to_element) {
  const names = from_element.getAttributeNames();
  for (const name of names) {
    const value = from_element.getAttribute(name);
    to_element.setAttribute(name, value);
  }
}
