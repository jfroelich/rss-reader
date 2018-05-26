import {is_boolean_attribute} from '/src/lib/dom/is-boolean-attribute.js';

export function filter_empty_attrs(document) {
  if (document.body) {
    const elements = document.body.getElementsByTagName('*');
    for (const element of elements) {
      filter_element(element);
    }
  }
}

function filter_element(element) {
  const names = element.getAttributeNames();
  for (const name of names) {
    if (!is_boolean_attribute(element, name)) {
      const value = element.getAttribute(name);
      if (typeof value !== 'string' || !value.trim()) {
        element.removeAttribute(name);
      }
    }
  }
}
