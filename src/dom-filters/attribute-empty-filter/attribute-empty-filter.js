import * as attribute_utils from '/src/dom-filters/attribute-empty-filter/attribute-utils.js';

// TODO: rename to something like attribute-value-filter, or
// attribute-value-length-filter?

export function attribute_empty_filter(document) {
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
    if (!attribute_utils.is_boolean(element, name)) {
      const value = element.getAttribute(name);
      if (typeof value !== 'string' || !value.trim()) {
        element.removeAttribute(name);
      }
    }
  }
}
