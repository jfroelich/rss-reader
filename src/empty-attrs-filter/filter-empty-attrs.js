import * as attribute from './attribute.js';

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
    if (!attribute.is_boolean(element, name)) {
      const value = element.getAttribute(name);
      if (typeof value !== 'string' || !value.trim()) {
        element.removeAttribute(name);
      }
    }
  }
}
