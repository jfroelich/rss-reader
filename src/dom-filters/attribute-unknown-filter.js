import assert from '/src/assert.js';

// TODO: rename to something like attribute-name-whitelist-filter

// Removes certain attributes from all elements in a document.
// This applies to the whole document, not just body.
// @param whitelist {Object} each property is element name, each value is array
// of retainable attribute names
export function attribute_unknown_filter(document, whitelist) {
  assert(typeof whitelist === 'object');
  const elements = document.getElementsByTagName('*');
  for (const element of elements) {
    filter_element_attributes(element, whitelist);
  }
}

function filter_element_attributes(element, whitelist) {
  const attr_names = element.getAttributeNames();
  if (attr_names.length) {
    const whitelisted_names = whitelist[element.localName] || [];
    for (const attribute_name of attr_names) {
      if (!whitelisted_names.includes(attribute_name)) {
        element.removeAttribute(attribute_name);
      }
    }
  }
}
