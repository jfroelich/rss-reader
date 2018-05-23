import {attribute_is_boolean} from '/src/lib/attribute.js';

export function document_filter_empty_attributes(document) {
  if (document.body) {
    const elements = document.body.getElementsByTagName('*');
    for (const element of elements) {
      element_filter_empty_attributes(element);
    }
  }
}

export function element_filter_empty_attributes(element) {
  const names = element.getAttributeNames();
  for (const name of names) {
    if (!attribute_is_boolean(element, name)) {
      const value = element.getAttribute(name);
      if (typeof value !== 'string' || !value.trim()) {
        element.removeAttribute(name);
      }
    }
  }
}
