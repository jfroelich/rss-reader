
// Removes certain attributes from all elements in a document.
// This applies to the whole document, not just body.

// @param whitelist {Object} each property is element name, each value is array
// of retainable attribute names
export function filter_unknown_attrs(document, whitelist) {
  assert(typeof whitelist === 'object');
  const elements = document.getElementsByTagName('*');
  for (const element of elements) {
    filter_element_attrs(element, whitelist);
  }
}

function filter_element_attrs(element, whitelist) {
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

// TODO: deprecate
function assert(value, message) {
  if (!value) throw new Error(message || 'Assertion error');
}
