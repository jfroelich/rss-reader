const void_elements = [
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr'
];

export function coerce_element(element, new_name, copy_attributes = true) {
  const parent = element.parentNode;
  if (!parent) {
    return element;
  }

  if (!is_valid_element_name(new_name)) {
    throw new TypeError('Invalid new name ' + new_name);
  }

  if (element.localName === new_name.toLowerCase()) {
    return element;
  }

  const next_sibling = element.nextSibling;
  element.remove();
  // XSS: use the element's own document to create the new element
  const new_element = element.ownerDocument.createElement(new_name);

  if (copy_attributes) {
    copy_attrs(element, new_element);
  }

  move_child_nodes(element, new_element);
  return parent.insertBefore(new_element, next_sibling);
}

function move_child_nodes(src, dst) {
  if (!void_elements.includes(dst.localName)) {
    for (let node = src.firstChild; node; node = src.firstChild) {
      dst.appendChild(node);
    }
  }
}

function is_valid_element_name(value) {
  return value && typeof value === 'string' && !value.includes(' ');
}

export function copy_attrs(src, dst) {
  const names = src.getAttributeNames();
  for (const name of names) {
    dst.setAttribute(name, src.getAttribute(name));
  }
}
